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

var send = require('./send');

module.exports = function queryTables (req, res, next) {
	req.tableService.queryTables(function (error, result, response) {
		send.errorElse(res, error, function () {
			var tables = [];
			for (var tbl in result) {
				var table = result[tbl];
				if (table.TableName) {
					tables.push(table.TableName);
				}
			}

			send.content(res, {
				tables: tables,
				name: req.tableService.storageAccount,
			}, 'result');
		})
	});
}
