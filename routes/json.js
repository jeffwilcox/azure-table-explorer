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

var   express = require('express')
    , app = module.exports = express()
    , azure = require('azure')

    , queryTables = require('./json/queryTables')
    , queryTable = require('./json/queryTable')
    , deleteRow = require('./json/deleteRow')

    , tableServiceMiddleware = require('./json/tableServiceMiddleware');

app.use(tableServiceMiddleware);

app.get('/table', queryTables);
app.get('/table/:tableName', queryTable);
app.delete('/table/:tableName/:partitionKey/:rowKey', deleteRow);
