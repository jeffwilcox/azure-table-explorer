!function ($) {

  $(function(){

    var $window = $(window)

    // Disable certain links in docs
    $('section [href^=#]').click(function (e) {
      e.preventDefault()
    })

  })

  // Error counter
  var ajaxErrorCount = 0;

  // Credentials  
  var storageAccount = undefined;
  var storageKey = undefined;

  // Page state
  var selectedRows = {};
  var maxResults = 10;
  
  // Page data
  var currentPageData = undefined;

  // Page and view variables
  var pageRowCount = 0;
  var currentPage = 0;
  var currentTableName = undefined;
  var pagingKeys = [];

  var emptyCallback = function() {};

  function setCredentials() {
    storageAccount = $('#storageAccount').val();
    storageKey = $('#storageKey').val();

    $('#credentials').hide();

    loadTablesList();

    return false;
  }

  function credentialsNeeded() {
    $('#credentials').show();
  }

  function deleteClicked() {
    var sr = getSelectedRows();
    if (sr.length > 0) {
      deleteSelectedRows(sr);
    }
    return false;
  }

  function deleteSelectedRows(sr) {
    // This is lazy but functional right now since each row is an individual POST.
    if (sr === undefined) {
      sr = getSelectedRows();
    }
    if (sr.length > 0) {
      var row = sr.pop();
      selectedRows[row] = false;
      sendRowDeleteByNumber(row, deleteSelectedRows);
    } else {
      navigateToPage();
    }
  }

  function showProgress() {
    var p = $('#pleaseWait');
    if (p) {
      p.show();
    }
  }

  function hideProgress() {
    var p = $('#pleaseWait');
    if (p) {
      p.hide();
    }
  }

  function logoConfirm() {
    return confirm("This will take you to www.WindowsAzure.com. Is that what you're expecting?");
  }

  function sendRowDeleteByNumber(rowNumber, callback) {
    var rowData = currentPageData[rowNumber];
    if (rowData && rowData.PartitionKey && rowData.RowKey) {
      sendRowDelete(currentTableName, rowData.PartitionKey, rowData.RowKey, callback);
    } else {
      callback();
    }
  }

  function sendRowDelete(tableName, partitionKey, rowKey, callback) {
    callback = callback || emptyCallback;
    var data = getStandardAjaxData();
    
    // BUG: For some reason jQuery DELETE/POST does not send any query string. Was leading to 403s.
    var url = "/json/table/" + encodeURIComponent(tableName) + 
        "/" + encodeURIComponent(partitionKey) + 
        "/" + encodeURIComponent(rowKey)
        + getStandardAjaxDataQueryString();
    
    $.ajax({
      type: 'DELETE',
      url: url,
      // data: data,
      success: function (data) {
        showErrorElse(data, callback);
      }
    });
  }

  function getSelectedRows() {
    var sr = [];
    for (var row in selectedRows) {
      if (selectedRows[row] === true) {
        sr.push(row);
      }
    }
    return sr;
  }

  function calculateDeleteButton() {
    if (getSelectedRows().length > 0) {
      $('#liDelete').show();
    } else {
      $('#liDelete').hide();
    }
  }

  function showError(subject, content) {
    $("#modal_error_subject").html(subject);
    $("#modal_error_text").html(content);
    $("#modal_error").modal('show');
  }

  function hideError() {
    $("#modal_error").modal('hide');
  }

  function showErrorElse(json, callback) {
    if (json.ok === true) {
      callback();
    } else {
      var subject = 'Error';
      var text = 'Something went wrong with the dynamic request.';

      showError(subject, text);
    }
  }

  $(document).ajaxError(function (event, request, settings) {
    ++ajaxErrorCount;

    var subject = 'Error';
    var text = 'Something went wrong. Oops.';

    if (request.status == 403) {
      credentialsNeeded();

      if (ajaxErrorCount == 1) {
        return;
      }

      subject = '403 Unauthorized';
      text = '<p>An unauthorized response was returned. Most likely this means:</p><ul><li>The storage account credentials are incorrect</li><li>No credentials have been provided</li></ul><p><small>Also: you can configure environment variables on the cloud side to automatically authenticate the table explorer.</small></p>';
    } else {
      text = request.statusText || request.responseText;
    }

    showError(subject, text);
  });

  $("#modal_close").click(hideError);

  window.getTable = function (tableName) {
  	$("#table-link-" + tableName).addClass("active");

  	for (var tbl in window.tables) {
  		var table = window.tables[tbl];
  		if (table != tableName) {
  			$("#table-link-" + table).removeClass("active");
  		}
  	}

  	loadTable(tableName);

  	return false;
  }

  window.tables = [];

  function getUniqueColumns(table) {
    var columns = [];
    var hash = {
      PartitionKey: true,
      RowKey: true
      // Timestamp: false
    };

    for (var r in table) {
      var row = table[r];
      for (var column in row) {
        if (column == '_') {
          // etag, id, link, updated
          continue;
        }
        if (!hash[column]) {
          hash[column] = true;
          columns.push(column);
        }
      }
    }

    return columns;
  }

  function resetPageView() {
    selectedRows = {};
    calculateDeleteButton();
  }

  function navigateToPage(page) {
    if (page === undefined) {
      page = currentPage;
    }
    var asNumber = +page;
    if (asNumber > 0) {
      var c = asNumber > 1 ? pagingKeys[asNumber - 1] : 0;
      var cc = c.nextRowKey && c.nextPartitionKey ? c : undefined;
      if (asNumber == 1 || c) {
        loadTable(currentTableName, asNumber, c);
      } else {
        showError('No partition/row paging info', 
          'The required nextRowKey and nextPartitionKey data is not currently available to enable this paging operation.');
      }
    }
  }

  function loadTableData(tableName, table, page) {
    if (page === undefined) {
      page = 1;
    }

    currentPage = page;

    if (table.rows && table.rows.length && table.rows.length > 0) {
      // Calculate the fields used in the table.
      var fields = getUniqueColumns(table.rows);

      var tableData = table.rows;
      currentPageData = tableData;
      
      resetPageView();      

      var partitionKey = undefined;

      // Data grid! Nasty code.
      var html = [];
      html.push('<table class="table table-condensed">'); // table-hover 
      html.push('<thead><th style="width:20px"></th>');
      for (var c in fields) {
        var field = fields[c];
        html.push('<th>');
        html.push('<p>' + field + '</p>');
        html.push('</th>');
      }
      html.push('</thead>');

      html.push('<tbody>');

      var rc = 0;
      var clicks = [];
      for (var t in table.rows) {
        var row = table.rows[t];

        if (row.PartitionKey != partitionKey) {
          partitionKey = row.PartitionKey;
          html.push('<tr class="row');
          html.push('' + rc);
          html.push('" style="background-color:#eee"><td></td><td colspan="');
          html.push((fields.length - 1) + '">');
          html.push('<h3>');
          html.push(partitionKey);
          html.push('</h3>');
          html.push('</td><td><p class="text-right"><small>PARTITION KEY</small></p></td></tr>');
        }

        html.push('<tr class="master-row" id="tblrow' + rc + '">');

        html.push('<td>');
        html.push('<input type="checkbox" id="tblchecked' + rc + '"/>');
        html.push('</td>');

        for (var field in fields) {
          var column = fields[field];
          html.push('<td>');
          html.push('<p>');

          if (row[column]) {
            var val = row[column];

            if (column == 'Timestamp') {
              val = moment(val).calendar();
            }

            html.push(val);
          }

          html.push('</p>');
          html.push('</td>');
        }

        html.push('</tr>');

        /*
        html.push('<tr class="table-detail" id="tbldetail' + rc + '" style="display: none"><td></td>');
        html.push('<td class="table-detail" id="tbldetailtd' + rc + '" colspan="' + fields.length + '">');
        html.push('</td>');
        html.push('</tr>');
        */

        ++rc;
      }

      pageRowCount = rc;

      html.push('</tbody>');
      html.push('</table>');

      // Pagination
      var hasContinuation = table.continuation && table.continuation.nextRowKey && table.continuation.nextPartitionKey;

      pagingKeys[page] = table.continuation;

      var ip = +page; // ensure it is a number

      html.push('<div class="pagination"><ul>');

      var buttons = {};

      // Previous
      html.push('<li');
      if (ip <= 1) {
        html.push(' class="disabled"');
      }      
      html.push('><a class="pageto');
      var n = ip - 1;
      buttons[n] = true;
      html.push('' + n);
      html.push('" href="#">&larr;</a></li>');

      // Numbers
      var start = ip > 5 ? ip - 5 : 1;
      var end = ip + 2;

      if (start > 1) {
        html.push('<li><a class="pageto1" href="#">1</a></li>');
        buttons[1] = true;

        if (start > 2) {
          html.push('<li class="disabled"><a href="#">...</a></li>');
        }
      }

      for (var i = start; i < end; i++) {
        html.push('<li');
        if (i == ip) {
          html.push(' class="active"');
        }
        html.push('><a class="pageto');
        html.push('' + i);
        html.push('" href="#">');
        html.push('' + i);
        html.push('</a></li>');

        buttons[i] = true;
      }

      // Next
      html.push('<li');
      if (!hasContinuation) {
        html.push(' class="disabled"');
      }
      html.push('><a class="pageto');
      html.push('' + (end-1));
      html.push('" href="#">&rarr;</a></li>');

      html.push('</ul>');

      html.push('<div class="pull-right" id="pleaseWait" style="display: none"><p><small>Please wait...</small></p></div>');

      html.push('</div>');

      // to string
      $('#results').html(html.join(''));

      // Wire up pagination
      for (var alink in buttons) {
        if (buttons[alink] === true) {
          (function(alink) {
            $('.pageto' + alink).click(function(){
              var asNumber = +alink;
              navigateToPage(asNumber);
              return false;
            });
          })(alink);
        }
      }

      // Wire up table master details view [tableData is the rows array]
      for (var i = 0; i < tableData.length; ++i) {
        (function(i) {
          var row = tableData[i];

          var rowMaster = $('#tblrow' + i);
          var rowDetails = $('#rowDetails');

          rowDetails.empty();

          rowMaster.click(function () {
            var isExpanded = (selectedRows[i] === true);
            var checkbox = $('#tblchecked' + i);

            if (isExpanded) {
              rowDetails.hide();
              rowMaster.removeClass('master-row-selected');
            } else {
              var h = [];
              rowMaster.addClass('master-row-selected');

              h.push('<p>&nbsp;</p><ul class="nav nav-list"><li class="nav-header">ROW DETAILS</li>');
              h.push('<li><small>');

              h.push('<p><strong>ID</strong><br />');
              h.push('<input type="text" id="id" value="' + row._.id + '" />');
              h.push('</p>');

              h.push('<p><strong>Timestamp</strong><br />');
              h.push(moment(row.Timestamp).format());
              h.push('</p>');

              h.push('<p><strong>Link</strong><br />');
              h.push('<input type="text" id="link" value="' + row._.link + '" />');
              h.push('</p>');

              h.push('<p><strong>Updated</strong><br />');
              h.push(row._.updated);
              h.push('</p>');

              h.push('<p><strong>ETag</strong><br />');
              var htmlEtag = $('<div/>').text(row._.etag).html();
              h.push(htmlEtag);
              h.push('</p>');

              h.push('</small></li>')

              rowDetails.html(h.join(''));
              rowDetails.show();
            }

            selectedRows[i] =!isExpanded;
            checkbox.prop('checked', !isExpanded);
            calculateDeleteButton();
          });
        })(i);
      }
    } else {
      $('#results').html('<h2>Clean slate.</h2><p>There are no rows in the ' + tableName + ' table.');
    }
  }

  function loadTable(tableName, page, continuation) {
    currentTableName = tableName;

    var data = getStandardAjaxData();
    if (continuation) {
      data.nextRowKey = continuation.nextRowKey;
      data.nextPartitionKey = continuation.nextPartitionKey;
    }

  	$.ajax({
  		url: "/json/table/" + tableName,
      data: data,
  		success: function (data) {
        showErrorElse(data, function () {
          loadTableData(tableName, data.table, page);
        });
  		}
  	});
  }

  function getStandardAjaxData() {
    return {
      account: storageKey ? storageAccount : undefined,
      key: storageKey,
      top: maxResults
    };
  }

  function getStandardAjaxDataQueryString() {
    var qs = '';
    var c = 0;
    var data = getStandardAjaxData();
    for (var d in data) {
      if (data[d]) {
        if (c == 0) {
          qs = '?';
        } else {
          qs += '&';
        }
        qs += d;
        qs += '=';
        qs += encodeURIComponent(data[d]);

        ++c;
      }
    }
    return qs;
  }

  var loadTablesList = function () {
    $.ajax({ 
    	url: "/json/table",
      data: getStandardAjaxData(),
    	success: function (data) {
        showErrorElse(data, function () {
          $('#results').show();

          dr = data.result;
          if (dr.name) {
            storageAccount = dr.name;
            $('#accountName').html(storageAccount);
          }

          window.tables = [];
          var tableList = $("#tableList");
          tableList.empty();

          var html = '<ul class="nav nav-list">';
          html += '<li class="nav-header">Tables</li>';
          
          var c = 0;
          for (var tbl in dr.tables) {
            var table = dr.tables[tbl];

            html += '<li id="table-link-' + table + '">';
            html += '<a href="#" onclick="';
            html += 'return window.getTable(' + "'" + table + "'" + ');">' + table + '</a></li>';

            window.tables.push(table);
            ++c;
          }

          if (c == 0) {
            html += '<li>No tables</li>';
          }

          html += '</ul>';
          tableList.append(html);
        });
    	}});
  }

  // 1. Security check
  var ssl = document.location.protocol === "https:";
  $('#' + (ssl ? '' : 'no') + 'ssl').show();
  $('#' + (ssl ? 'no' : '') + 'ssl').hide();
  $('#setCredentials').click(setCredentials);

  // 2. Global Ajax events
  $(document).ajaxStart(showProgress);
  $(document).ajaxStop(hideProgress);

  // 3. Load the table list (will 403 to show the login form if server credentials are not being used)
  loadTablesList();

  // 4. Hook up events to buttons.
  $('#delete').click(deleteClicked);
  $('.brand').click(logoConfirm);

  // 5. Calculate a good starting # of results to return vs the constant.
  var height = $(document).height();
  if (height > 800) {
    height -= 375;
    height /= 45;
    height = Math.round(height);
    maxResults = height;
  }

}(window.jQuery)
