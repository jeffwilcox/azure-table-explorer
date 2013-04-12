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

var azure = require('azure');

module.exports = function getTableServiceInstance(req, res, next) {
	var account = process.env.AZURE_STORAGE_ACCOUNT || req.query["account"];
	var key     = process.env.AZURE_STORAGE_ACCESS_KEY || req.query["key"];
	if (account === undefined && key === undefined) {
		return res.send(403);
	}

	//var oldJson = res.json;
	//res.json = function (obj) {
		//res.send('<pre style="font-size: 10pt; font-family: Consolas">' + JSON.stringify(obj, null, 2) + '</pre>');
	//};

	try {
		req.tableService = azure.createTableService(account, key);
	}
	catch (err) {
		return res.send(403);
	}

	next();
}
