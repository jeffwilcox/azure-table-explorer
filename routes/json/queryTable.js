//
// Copyright © Jeff Wilcox
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

var   send = require('./send')
    , azure = require('azure')
    , TableQuery = azure.TableQuery;

module.exports = function queryTable (req, res, next) {
	var top = req.query.top || 15;

	var query = TableQuery
    		.select()
    		.from(req.params.tableName)
    		.top(top);

    if (req.query.nextRowKey && req.query.nextPartitionKey) {
    	query = query.whereNextKeys(req.query.nextPartitionKey, req.query.nextRowKey);
    }

	req.tableService.queryEntities(query, function (error, result, continuation, response) {
		send.errorElse(res, error, function () {
			var table = { };
			if (continuation && continuation.nextPartitionKey && continuation.nextRowKey) {
				table.continuation = {
					nextPartitionKey: continuation.nextPartitionKey,
					nextRowKey: continuation.nextRowKey
				};
			}
			table.rows = result;

			send.content(res, table, 'table');
		});
	});
}
