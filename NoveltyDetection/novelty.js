"use strict"

// Import libraries
let qm = require('qminer');
let fs = require('fs');
let readline = require('readline');

// Define the storage schema. We define one store called 'articles'.
let base = new qm.Base({
    mode: 'createClean',
    schema:[
        {
            name: 'Articles',
            fields: [
                { name: 'Time', type: 'datetime' },
                { name: 'Text', type: 'string' },
                { name: 'Title', type: 'string' },
                { name: 'Number', type: 'float' }
            ]
        }
    ]
})

// Define articles store
let articles = base.store('Articles');

// Define a feature space aggregator on the articles.
let aggrFSA = {
   name: "ftrSpaceAggr",
   type: "featureSpace",
   initCount: 2,
   update: true, full: false, sparse: true,
   featureSpace: [
        { 
            type: "text", source: "Articles", field: 'Text',
            weight: 'tfidf', // none, tf, idf, tfidf
            tokenizer: {
                type: 'simple',
                stopwords: 'en', // none, en, [...]
                stemmer: 'porter' // porter, none
            },
            ngrams: 2,
            normalize: true
        }
    ]
}; 

let ftrSpaceAggr = articles.addStreamAggr(aggrFSA);

// define a new time series tick stream aggregator for the 'Cars' store, that takes the values from the 'NumberOfCars' field
// and the timestamp from the 'Time' field.
let aggrT = {
    name: "tickAggr",
    type: "timeSeriesTick",
    store: "articles",
    timestamp: "Time",
    value: "Number"
};
//create the tick aggregator
let tickAggr = articles.addStreamAggr(aggrT);

// Define an anomaly detection aggregator using nearest neighbor on the articles store that takes as input timestamped features.
// The time stamp is provided by the tick aggregator while the feature vector is provided by the feature space aggregator.
var aggrAD = {
    name: 'AnomalyDetectorAggr',
    type: 'nnAnomalyDetector',
    inAggrSpV: 'ftrSpaceAggr',
    inAggrTm: 'tickAggr',
    rate: [0.15, 0.5, 0.7],
    windowSize: 200
};

// Create the anomaly detection aggregator
var anomaly = articles.addStreamAggr(aggrAD);



// Define monitoring stream aggregate.
let monitoringAggr = articles.addStreamAggr({
    onAdd: (rec) => {        
        // console.log(rec)
    	console.log(anomaly.getInteger(), rec["Title"]);
    }
})


// load articles into the store
let ARTICLES_FILENAME = "../ERworker/data/PeterPrevcENG.json";

let lineReader = readline.createInterface({
    input: fs.createReadStream(ARTICLES_FILENAME)
})

// insert new article into the articles store
lineReader.on('line', function(line) {
    let currentArticle = JSON.parse(line);    
    articles.push({ Time: currentArticle["date"] + "T" + currentArticle["time"], Text: currentArticle["body"], Title: currentArticle["title"], Number: 1});
})