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

// define a 'fake' time series tick stream aggregator for the 'Articles' store
// to trigger feature space aggregate
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
    rate: [0.2, 0.05, 0.01],
    windowSize: 4000
};

// Create the anomaly detection aggregator
var anomaly = articles.addStreamAggr(aggrAD);

// Define monitoring stream aggregate.
let monitoringAggr = articles.addStreamAggr({
    onAdd: (rec) => {        
        // console.log(rec)
        let explanation = anomaly.saveJson().explanation;
        var distance = 0;
        if ("distance" in explanation) distance = explanation.distance;
        // console.log(explanation);
        if (anomaly.getInteger() > 2) console.log(anomaly.getInteger(), rec["Title"], distance);
        fs.appendFileSync('eval.csv', anomaly.getInteger() + ";~" + rec["Title"] + "~;" + tickAggr.getTimestamp() + "\n");
    }
})

// add header to log file
fs.writeFileSync('eval.csv', "rate;title;timestamp\n");


// load articles into the store via simulated stream
let ARTICLES_FILENAME = "../ERworker/data/MicrosoftENG.json";

let lineReader = readline.createInterface({
    input: fs.createReadStream(ARTICLES_FILENAME)
})

// insert new article into the articles store
lineReader.on('line', function(line) {
    try {
        let currentArticle = JSON.parse(line);    
        articles.push({ Time: currentArticle["date"] + "T" + currentArticle["time"], Text: currentArticle["body"], Title: currentArticle["title"], Number: 1});
    } catch (e) {
        console.log(e);
    }
})