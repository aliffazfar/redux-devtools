"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.composeWithDevTools = composeWithDevTools;
exports.default = void 0;
var _jsan = require("jsan");
var _socketclusterClient = _interopRequireDefault(require("socketcluster-client"));
var _configureStore = _interopRequireDefault(require("./configureStore"));
var _constants = require("./constants");
var _rnHostDetect = _interopRequireDefault(require("rn-host-detect"));
var _utils = require("@redux-devtools/utils");
function _asyncIterator(r) { var n, t, o, e = 2; for ("undefined" != typeof Symbol && (t = Symbol.asyncIterator, o = Symbol.iterator); e--;) { if (t && null != (n = r[t])) return n.call(r); if (o && null != (n = r[o])) return new AsyncFromSyncIterator(n.call(r)); t = "@@asyncIterator", o = "@@iterator"; } throw new TypeError("Object is not async iterable"); }
function AsyncFromSyncIterator(r) { function AsyncFromSyncIteratorContinuation(r) { if (Object(r) !== r) return Promise.reject(new TypeError(r + " is not an object.")); var n = r.done; return Promise.resolve(r.value).then(function (r) { return { value: r, done: n }; }); } return AsyncFromSyncIterator = function (r) { this.s = r, this.n = r.next; }, AsyncFromSyncIterator.prototype = { s: null, n: null, next: function () { return AsyncFromSyncIteratorContinuation(this.n.apply(this.s, arguments)); }, return: function (r) { var n = this.s.return; return void 0 === n ? Promise.resolve({ value: r, done: !0 }) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments)); }, throw: function (r) { var n = this.s.return; return void 0 === n ? Promise.reject(r) : AsyncFromSyncIteratorContinuation(n.apply(this.s, arguments)); } }, new AsyncFromSyncIterator(r); }
function async(fn) {
  setTimeout(fn, 0);
}
function str2array(str) {
  return typeof str === 'string' ? [str] : str && str.length > 0 ? str : undefined;
}
function getRandomId() {
  return Math.random().toString(36).substr(2);
}
class DevToolsEnhancer {
  // eslint-disable-next-line @typescript-eslint/ban-types

  errorCounts = {};
  getLiftedStateRaw() {
    return this.store.liftedStore.getState();
  }
  getLiftedState() {
    return (0, _utils.filterStagedActions)(this.getLiftedStateRaw(), this.filters);
  }
  send = () => {
    if (!this.instanceId) this.instanceId = this.socket && this.socket.id || getRandomId();
    try {
      fetch(this.sendTo, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          type: 'STATE',
          id: this.instanceId,
          name: this.instanceName,
          payload: (0, _jsan.stringify)(this.getLiftedState())
        })
      }).catch(function (err) {
        console.log(err);
      });
    } catch (err) {
      console.log(err);
    }
  };
  relay(type, state, action, nextActionId) {
    const message = {
      type,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      id: this.socket.id,
      name: this.instanceName,
      instanceId: this.appInstanceId
    };
    if (state) {
      message.payload = type === 'ERROR' ? state : (0, _jsan.stringify)((0, _utils.filterState)(state, type, this.filters, this.stateSanitizer, this.actionSanitizer, nextActionId));
    }
    if (type === 'ACTION') {
      message.action = (0, _jsan.stringify)(!this.actionSanitizer ? action : this.actionSanitizer(action.action, nextActionId - 1));
      message.isExcess = this.isExcess;
      message.nextActionId = nextActionId;
    } else if (action) {
      message.action = action;
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    void this.socket.transmit(this.socket.id ? 'log' : 'log-noid', message);
  }
  dispatchRemotely(action) {
    try {
      const result = (0, _utils.evalAction)(action, this.actionCreators);
      this.store.dispatch(result);
    } catch (e) {
      this.relay('ERROR', e.message);
    }
  }
  handleMessages = message => {
    if (message.type === 'IMPORT' || message.type === 'SYNC' &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    this.socket.id &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    message.id !== this.socket.id) {
      this.store.liftedStore.dispatch({
        type: 'IMPORT_STATE',
        // eslint-disable-next-line @typescript-eslint/ban-types
        nextLiftedState: (0, _jsan.parse)(message.state)
      });
    } else if (message.type === 'UPDATE') {
      this.relay('STATE', this.getLiftedState());
    } else if (message.type === 'START') {
      this.isMonitored = true;
      if (typeof this.actionCreators === 'function') this.actionCreators = this.actionCreators();
      this.relay('STATE', this.getLiftedState(), this.actionCreators);
    } else if (message.type === 'STOP' || message.type === 'DISCONNECTED') {
      this.isMonitored = false;
      this.relay('STOP');
    } else if (message.type === 'ACTION') {
      this.dispatchRemotely(message.action);
    } else if (message.type === 'DISPATCH') {
      this.store.liftedStore.dispatch(message.action);
    }
  };
  sendError = errorAction => {
    // Prevent flooding
    if (errorAction.message && errorAction.message === this.lastErrorMsg) return;
    this.lastErrorMsg = errorAction.message;
    async(() => {
      this.store.dispatch(errorAction);
      if (!this.started) this.send();
    });
  };
  init(options) {
    this.instanceName = options.name;
    this.appInstanceId = getRandomId();
    const {
      blacklist,
      whitelist,
      denylist,
      allowlist
    } = options.filters || {};
    this.filters = (0, _utils.getLocalFilter)({
      actionsDenylist: denylist ?? options.actionsDenylist ?? blacklist ?? options.actionsBlacklist,
      actionsAllowlist: allowlist ?? options.actionsAllowlist ?? whitelist ?? options.actionsWhitelist
    });
    if (options.port) {
      this.socketOptions = {
        port: options.port,
        hostname: options.hostname || 'localhost',
        secure: options.secure
      };
    } else this.socketOptions = _constants.defaultSocketOptions;
    this.suppressConnectErrors = options.suppressConnectErrors !== undefined ? options.suppressConnectErrors : true;
    this.startOn = str2array(options.startOn);
    this.stopOn = str2array(options.stopOn);
    this.sendOn = str2array(options.sendOn);
    this.sendOnError = options.sendOnError;
    if (this.sendOn || this.sendOnError) {
      this.sendTo = options.sendTo || `${this.socketOptions.secure ? 'https' : 'http'}://${this.socketOptions.hostname}:${this.socketOptions.port}`;
      this.instanceId = options.id;
    }
    if (this.sendOnError === 1) (0, _utils.catchErrors)(this.sendError);
    if (options.actionCreators) this.actionCreators = () => (0, _utils.getActionsArray)(options.actionCreators);
    this.stateSanitizer = options.stateSanitizer;
    this.actionSanitizer = options.actionSanitizer;
  }
  login() {
    void (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        const channelName = await this.socket.invoke('login', 'master');
        this.channel = channelName;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
        var _iteratorAbruptCompletion = false;
        var _didIteratorError = false;
        var _iteratorError;
        try {
          for (var _iterator = _asyncIterator(this.socket.subscribe(channelName)), _step; _iteratorAbruptCompletion = !(_step = await _iterator.next()).done; _iteratorAbruptCompletion = false) {
            const data = _step.value;
            {
              this.handleMessages(data);
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (_iteratorAbruptCompletion && _iterator.return != null) {
              await _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      } catch (error) {
        console.log(error);
      }
    })();
    this.started = true;
    this.relay('START');
  }
  stop = keepConnected => {
    this.started = false;
    this.isMonitored = false;
    if (!this.socket) return;
    void this.socket.unsubscribe(this.channel);
    this.socket.closeChannel(this.channel);
    if (!keepConnected) {
      this.socket.disconnect();
    }
  };
  start = () => {
    if (this.started || this.socket && this.socket.getState() === this.socket.CONNECTING) return;
    this.socket = _socketclusterClient.default.create(this.socketOptions);
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      var _iteratorAbruptCompletion2 = false;
      var _didIteratorError2 = false;
      var _iteratorError2;
      try {
        for (var _iterator2 = _asyncIterator(this.socket.listener('error')), _step2; _iteratorAbruptCompletion2 = !(_step2 = await _iterator2.next()).done; _iteratorAbruptCompletion2 = false) {
          const data = _step2.value;
          {
            // if we've already had this error before, increment it's counter, otherwise assign it '1' since we've had the error once.
            // eslint-disable-next-line no-prototype-builtins,@typescript-eslint/no-unsafe-argument
            this.errorCounts[data.error.name] = this.errorCounts.hasOwnProperty(data.error.name) ? this.errorCounts[data.error.name] + 1 : 1;
            if (this.suppressConnectErrors) {
              if (this.errorCounts[data.error.name] === 1) {
                console.log('remote-redux-devtools: Socket connection errors are being suppressed. ' + '\n' + "This can be disabled by setting suppressConnectErrors to 'false'.");
                console.log(data.error);
              }
            } else {
              console.log(data.error);
            }
          }
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (_iteratorAbruptCompletion2 && _iterator2.return != null) {
            await _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }
    })();
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      var _iteratorAbruptCompletion3 = false;
      var _didIteratorError3 = false;
      var _iteratorError3;
      try {
        for (var _iterator3 = _asyncIterator(this.socket.listener('connect')), _step3; _iteratorAbruptCompletion3 = !(_step3 = await _iterator3.next()).done; _iteratorAbruptCompletion3 = false) {
          const data = _step3.value;
          {
            console.log('connected to remotedev-server');
            this.errorCounts = {}; // clear the errorCounts object, so that we'll log any new errors in the event of a disconnect
            this.login();
          }
        }
      } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
      } finally {
        try {
          if (_iteratorAbruptCompletion3 && _iterator3.return != null) {
            await _iterator3.return();
          }
        } finally {
          if (_didIteratorError3) {
            throw _iteratorError3;
          }
        }
      }
    })();
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      var _iteratorAbruptCompletion4 = false;
      var _didIteratorError4 = false;
      var _iteratorError4;
      try {
        for (var _iterator4 = _asyncIterator(this.socket.listener('disconnect')), _step4; _iteratorAbruptCompletion4 = !(_step4 = await _iterator4.next()).done; _iteratorAbruptCompletion4 = false) {
          const data = _step4.value;
          {
            this.stop(true);
          }
        }
      } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
      } finally {
        try {
          if (_iteratorAbruptCompletion4 && _iterator4.return != null) {
            await _iterator4.return();
          }
        } finally {
          if (_didIteratorError4) {
            throw _iteratorError4;
          }
        }
      }
    })();
  };
  checkForReducerErrors = (() => {
    var _this = this;
    return function () {
      let liftedState = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _this.getLiftedStateRaw();
      if (liftedState.computedStates[liftedState.currentStateIndex].error) {
        if (_this.started) _this.relay('STATE', (0, _utils.filterStagedActions)(liftedState, _this.filters));else _this.send();
        return true;
      }
      return false;
    };
  })();

  // eslint-disable-next-line @typescript-eslint/ban-types
  monitorReducer = (() => {
    var _this2 = this;
    return function () {
      let state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      let action = arguments.length > 1 ? arguments[1] : undefined;
      _this2.lastAction = action.type;
      if (!_this2.started && _this2.sendOnError === 2 && _this2.store.liftedStore) async(_this2.checkForReducerErrors);else if (action.action) {
        if (_this2.startOn && !_this2.started && _this2.startOn.indexOf(action.action.type) !== -1) async(_this2.start);else if (_this2.stopOn && _this2.started && _this2.stopOn.indexOf(action.action.type) !== -1) async(_this2.stop);else if (_this2.sendOn && !_this2.started && _this2.sendOn.indexOf(action.action.type) !== -1) async(_this2.send);
      }
      return state;
    };
  })();

  // eslint-disable-next-line @typescript-eslint/ban-types
  handleChange(state, liftedState, maxAge) {
    if (this.checkForReducerErrors(liftedState)) return;
    if (this.lastAction === 'PERFORM_ACTION') {
      const nextActionId = liftedState.nextActionId;
      const liftedAction = liftedState.actionsById[nextActionId - 1];
      if ((0, _utils.isFiltered)(liftedAction.action, this.filters)) return;
      this.relay('ACTION', state, liftedAction, nextActionId);
      if (!this.isExcess && maxAge) this.isExcess = liftedState.stagedActionIds.length >= maxAge;
    } else {
      if (this.lastAction === 'JUMP_TO_STATE') return;
      if (this.lastAction === 'PAUSE_RECORDING') {
        this.paused = liftedState.isPaused;
      } else if (this.lastAction === 'LOCK_CHANGES') {
        this.locked = liftedState.isLocked;
      }
      if (this.paused || this.locked) {
        if (this.lastAction) this.lastAction = undefined;else return;
      }
      this.relay('STATE', (0, _utils.filterStagedActions)(liftedState, this.filters));
    }
  }
  enhance = (() => {
    var _this3 = this;
    return function () {
      let options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _this3.init({
        ...options,
        hostname: (0, _rnHostDetect.default)(options.hostname || 'localhost')
      });
      const realtime = typeof options.realtime === 'undefined' ? process.env.NODE_ENV === 'development' : options.realtime;
      if (!realtime && !(_this3.startOn || _this3.sendOn || _this3.sendOnError)) return f => f;
      const maxAge = options.maxAge || 30;
      return next => {
        return (reducer, initialState) => {
          _this3.store = (0, _configureStore.default)(next, _this3.monitorReducer, {
            maxAge,
            trace: options.trace,
            traceLimit: options.traceLimit,
            shouldCatchErrors: !!_this3.sendOnError,
            shouldHotReload: options.shouldHotReload,
            shouldRecordChanges: options.shouldRecordChanges,
            shouldStartLocked: options.shouldStartLocked,
            pauseActionType: options.pauseActionType || '@@PAUSED'
          })(reducer, initialState);
          if (realtime) _this3.start();
          _this3.store.subscribe(() => {
            if (_this3.isMonitored) _this3.handleChange(_this3.store.getState(), _this3.getLiftedStateRaw(), maxAge);
          });
          return _this3.store;
        };
      };
    };
  })();
}
var _default = options => new DevToolsEnhancer().enhance(options);
exports.default = _default;
const compose = options => function () {
  for (var _len = arguments.length, funcs = new Array(_len), _key = 0; _key < _len; _key++) {
    funcs[_key] = arguments[_key];
  }
  return function () {
    const devToolsEnhancer = new DevToolsEnhancer();
    function preEnhancer(createStore) {
      return (reducer, preloadedState) => {
        devToolsEnhancer.store = createStore(reducer, preloadedState);
        return {
          ...devToolsEnhancer.store,
          dispatch: action => devToolsEnhancer.locked ? action : devToolsEnhancer.store.dispatch(action)
        };
      };
    }
    for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }
    return [preEnhancer, ...funcs].reduceRight((composed, f) => f(composed), devToolsEnhancer.enhance(options)(...args));
  };
};
function composeWithDevTools() {
  for (var _len3 = arguments.length, funcs = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
    funcs[_key3] = arguments[_key3];
  }
  if (funcs.length === 0) {
    return new DevToolsEnhancer().enhance();
  }
  if (funcs.length === 1 && typeof funcs[0] === 'object') {
    return compose(funcs[0]);
  }
  return compose({})(...funcs);
}