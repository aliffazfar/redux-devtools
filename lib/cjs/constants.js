"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultSocketOptions = void 0;
const defaultSocketOptions = exports.defaultSocketOptions = {
  secure: false,
  hostname: 'localhost',
  port: 8000,
  autoReconnect: true,
  autoReconnectOptions: {
    randomness: 30000
  }
};