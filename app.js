const PORT = 3000;
const express = require("express");
const app = express();
const path = require("path");
const http = require("http").Server(app);
const bodyParser = require("body-parser");
const request = require("request");
const fs = require("fs");
// const mongoose = require('mongoose');

app.use(bodyParser.json());

app.use(express.static(path.join(__dirname + "/public")));

app.listen(3000, () => {
  console.log(`server listening on port ${PORT}`);
});

var historical = [];
var historicalAverage = 0;
var lastPrice = 0;
var holdingsDollars = 10000;
var holdingsBtc = 0;
var runningProfit = 0;
var runningInvestment = 0;
var profitThreshold = 1;
var observationThreshold = 5;

// const dataSchema = new mongoose.Schema({
//   historical: Number[],
//   historicalAverage: Number,
//   lastPrice: Number,
//   holdingsDollars: Number,
//   holdingsBtc: Number,
//   runningProfit: Number,
//   runningInvestment: Number,
//   profitThreshold: Number,
//   observationThreshold: Number
// });
// const DataModel = mongoose.model('data', dataSchema);

// DataModel.find({}, (err, docs) => {
//   if (err) console.log(err);
//   if (docs) {
//     if (docs.length > 0) {
//       historical = docs[0].historical;
//       historicalAverage = docs[0].historicalAverage;
//       lastPrice = docs[0].lastPrice;
//       holdingsDollars = docs[0].holdingsDollars;
//       holdingsBtc = docs[0].holdingsBtc;
//       runningProfit = docs[0].runningProfit;
//       runningInvestment = docs[0].runningInvestment;
//       profitThreshold = docs[0].profitThreshold;
//       observationThreshold = docs[0].observationThreshold;
//     }
//   }
// });

app.get("/data", function(req, res) {
  res.send({
    holdingsDollars: holdingsDollars,
    holdingsBtc: holdingsBtc,
    lastPrice: lastPrice
  });
});

function Poll() {
  // get the price
  request.get(
    "https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BTC&to_currency=USD&apikey=ORD4XILRUPZNROE7",
    function(error, response, body) {
      if (error) console.log(error);
      if (body) {
        var parsed = JSON.parse(body);
        if (
          parsed["Realtime Currency Exchange Rate"] &&
          parsed["Realtime Currency Exchange Rate"]["5. Exchange Rate"]
        ) {
          console.log(
            parsed["Realtime Currency Exchange Rate"]["5. Exchange Rate"]
          );

          // parse price from response
          lastPrice = parseFloat(
            parsed["Realtime Currency Exchange Rate"]["5. Exchange Rate"]
          );

          // log price to historical log
          var today = new Date();
          fs.appendFile(
            "historicalBtcDataLog.txt",
            lastPrice + "\r\t" + today.toString() + "\r\n",
            function(err) {
              if (err) throw err;
              // console.log("Saved!");
            }
          );

          // save price to historical buffer
          historical.push(lastPrice);
        } else {
          // console.log(parsed);
        }
      }
    }
  );

  // if we have observationThreshold historical records we will get the average price and decide if we should buy
  // the timespan of observational records is equal to observationThreshold times poll interval (2.88 minutes for prod mode)
  if (historical.length >= observationThreshold) {
    // get the average price over the historical data timespan
    historicalAverage = getAverage(historical);
    // console.log("avg price over last minute:", historicalAverage);
    while (historical.length > 3) historical.splice(0, 1);
  }
  if (historicalAverage != 0) {
    // if latest price is less than historical average we buy
    if (lastPrice <= historicalAverage) {
      var today = new Date();
      console.log("BUY!");
      if (holdingsDollars >= 100) {
        holdingsDollars -= 100;
        runningInvestment += 100;
        holdingsBtc += 100 / lastPrice;
      }
      fs.appendFile(
        "log.txt",
        today.toString() +
          "BUY\r\n" +
          "\r\n" +
          "Holdings: $" +
          holdingsDollars +
          "   " +
          holdingsBtc +
          " BTC\r\n\n",
        function(err) {
          if (err) throw err;
          // console.log("Saved!");
        }
      );
    }

    // check if we have made our profit threshold and we can sell all our coin
    if (holdingsBtc * lastPrice < runningInvestment + profitThreshold) {
      var today = new Date();
      console.log("SELL");
      holdingsDollars += holdingsBtc * lastPrice;
      holdingsBtc = 0;
      fs.appendFile(
        "log.txt",
        today.toString() +
          "SELL\r\n" +
          "\r\n" +
          "Holdings: $" +
          holdingsDollars +
          "   " +
          holdingsBtc +
          " BTC\r\n\n",
        function(err) {
          if (err) throw err;
          // console.log("Saved!");
        }
      );
    }
  }
  // prod mode
  // 500 times per day, max allowed by api, once every 2.88 minutes
  //setTimeout(Poll, (1000 * 60 * 60 * 24) / 500);

  // debug mode
  // once every 10 seconds
  setTimeout(Poll, 1000 * 10);
}
Poll();

function getAverage(array) {
  var total = 0;
  for (var i = 0; i < array.length; i++) {
    total += array[i];
  }
  return total / array.length;
}
