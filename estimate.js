var   azure = require('azure')
    , Table = require('easy-table');

if (process.argv.length < 4) {
	console.log(process.argv[1] + ' storage_account_name storage_key tableName');
	return;
}

var options = {
	account:   process.argv[2],
	key:       process.argv[3],
	tableName: process.argv[4]
}

var context = {
	options: options,
	transactions: 0,
	bytes: 0
};

function bytesToSize(bytes, precision) {  
    var kilobyte = 1024;
    var megabyte = kilobyte * 1024;
    var gigabyte = megabyte * 1024;
    var terabyte = gigabyte * 1024;
   
    if ((bytes >= 0) && (bytes < kilobyte)) {
        return bytes + ' B';
 
    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
        return (bytes / kilobyte).toFixed(precision) + ' KB';
 
    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
        return (bytes / megabyte).toFixed(precision) + ' MB';
 
    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
        return (bytes / gigabyte).toFixed(precision) + ' GB';
 
    } else if (bytes >= terabyte) {
        return (bytes / terabyte).toFixed(precision) + ' TB';
 
    } else {
        return bytes + ' B';
    }
}

function computeCost() {
	// Bytes in storage
	var gCost = 0.00;

	// Transactions, REST calls in this app execution
	var tCost = (0.01 / 100000) * context.transactions;

	return {
		storageReadable: bytesToSize(context.bytes, 2),
		storageCost: gCost.toFixed(2),
		transactions: context.transactions,
		transactionCost: tCost.toFixed(2),
		totalCost: (tCost + gCost).toFixed(2)
	};
}

function showComputedCost() {
	var t = new Table;
	var c = computeCost();

	t.cell('Component', 'Storage space');
	t.cell('Count', c.storageReadable);
	t.cell('Cost USD', c.storageCost);
	t.newRow();

	t.cell('Component', 'Transacations');
	t.cell('Count', c.transactions);
	t.cell('Cost USD', c.transactionCost);
	t.newRow();

	t.cell('Component', 'Total');
	t.cell('Cost USD', c.totalCost);
	t.newRow();
	
	console.log(t.toString());
}

var emptyCallback = function() {};

function showErrorElse(err, okCallback, optionalReason, optionalErrCallback) {
	if (err) {
		console.log((optionalReason || 'Error') + ':');
		console.dir(err);
		console.log();

		(optionalErrCallback || emptyCallback)();

		// Always show the cost so far in this run, too.
		showComputedCost();
	} else {
		okCallback();
	}
}

function listTables(tableService) {
	++context.transactions;

	tableService.queryTables(function (err, res, response) {
		showErrorElse(err, function() {
			
			var t = new Table;

			res.forEach(function (table) {
				t.cell('Table Name', table.TableName);
				t.newRow();
			});

			console.log(t.toString());

			showComputedCost();
		})
	});
}

function isNumber (o) {
  return ! isNaN (o-0) && o !== null && o !== "" && o !== false;
}

function isInt(n) {
   return n % 1 === 0;
}

function getRowBytes(row) {
	// Fixed per row.
	var bytes = 4;

	// Essentials
	bytes += (row.PartitionKey.length + row.RowKey.length) * 2;

	// Properties
	for (var thing in row) {
		if (thing == '_' || thing == 'PartitionKey' || thing == 'RowKey' || thing == 'Timestamp') continue;
		
		bytes += 8;
		bytes += thing.length * 2;

		var value = row[thing];

		// Not supported right now:
		// BINARY
		// GUID
		// INT64

		if (value.getMonth) {
			console.log('DATE!');
			bytes += 8;
		} else if (isNumber(value)) {
			if (isInt(value)) {
				console.log('INT');
				bytes += 4;
			} else {
				// DOUBLE is 8 bytes, fyi.
				console.log('Unsupported number type.');
				console.dir(row);
			}

			// Int64 is 8, fyi. Not supported here.
		} else if (typeof value == 'string' || value instanceof String) {
			bytes += 4;
			bytes += value.length * 2;
		} else {
			console.log('UNKNOWN TYPE');
			console.dir(row);
		}
	}

	return bytes;
}

function calculateRowCost(row) {
	var byteSize = getRowBytes(row);
	context.bytes += byteSize;
}

function calculateResultCost(result) {
	result.forEach(calculateRowCost);
}

function workTable(tableService, tableName) {
	var TableQuery = azure.TableQuery;
	var continuationsProcessed = 0;

	var nextRowKey = undefined;
	var nextPartitionKey = undefined;

	// Raw table cost.
	var tableBaseCost = 12;
	tableBaseCost += tableName.length * 2;
	context.bytes += tableBaseCost;

	var queryTable = function () {
		++context.transactions;

		var query = TableQuery
			.select()
			.from(tableName);
	    if (nextRowKey && nextPartitionKey) {
	    	++continuationsProcessed;
	    	query = query.whereNextKeys(nextPartitionKey, nextRowKey);
	    }

	    tableService.queryEntities(query, function (err, result, continuation, response) {
	    	showErrorElse(err, function() {

	    		if (continuationsProcessed % 10 == 0 && continuationsProcessed !== 0) {
	    			console.log('Processed ' + continuationsProcessed + ' continuations.');
	    		}

	    		if (continuationsProcessed % 50 == 0 && continuationsProcessed !== 0) {
	    			showComputedCost();
	    		}

				if (continuation && continuation.nextPartitionKey && continuation.nextRowKey) {
					var pk = continuation.nextPartitionKey;

					if (pk !== nextPartitionKey) {
						console.log('Partition Key: ' + pk);
					}

					nextRowKey = continuation.nextRowKey;
					nextPartitionKey = pk;
				}

				// Calculate size of this partition rows
				calculateResultCost(result);

	    		// Is there more work?
	    		if (continuation) {
	    			queryTable();
	    		} else {
	    			console.log();
	    			console.log('*** No more continuation tokens ***');
	    			console.log();

	    			showComputedCost();
	    		}
	    	});
	    });
	};

	queryTable();
}

var tableService = azure.createTableService(options.account, options.key);

if (process.argv.length === 4) {
	listTables(tableService);
} else {
	workTable(tableService, options.tableName);
}
