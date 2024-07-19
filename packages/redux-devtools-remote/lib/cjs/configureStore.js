"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = configureStore;
var _instrument = require("@redux-devtools/instrument");
function configureStore(
// eslint-disable-next-line @typescript-eslint/ban-types
next, subscriber, options) {
  return (0, _instrument.instrument)(subscriber, options)(next);
}