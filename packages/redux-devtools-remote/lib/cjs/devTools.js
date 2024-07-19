'use strict';

var _interopRequireDefault = require('@babel/runtime/helpers/interopRequireDefault');
Object.defineProperty(exports, '__esModule', {
  value: true,
});
exports.composeWithDevTools = composeWithDevTools;
exports.default = void 0;
var _defineProperty2 = _interopRequireDefault(
  require('@babel/runtime/helpers/defineProperty'),
);
var _jsan = require('jsan');
var _socketclusterClient = _interopRequireDefault(
  require('socketcluster-client'),
);
var _configureStore = _interopRequireDefault(require('./configureStore'));
var _constants = require('./constants');
var _rnHostDetect = _interopRequireDefault(require('rn-host-detect'));
var _utils = require('@redux-devtools/utils');
function async(fn) {
  setTimeout(fn, 0);
}
function str2array(str) {
  return typeof str === 'string'
    ? [str]
    : str && str.length > 0
    ? str
    : undefined;
}
function getRandomId() {
  return Math.random().toString(36).substr(2);
}
class DevToolsEnhancer {
  constructor() {
    var _this = this;
    (0, _defineProperty2.default)(this, 'errorCounts', {});
    (0, _defineProperty2.default)(this, 'send', () => {
      if (!this.instanceId) {
        this.instanceId = (this.socket && this.socket.id) || getRandomId();
      }
      try {
        fetch(this.sendTo, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            type: 'STATE',
            id: this.instanceId,
            name: this.instanceName,
            payload: (0, _jsan.stringify)(this.getLiftedState()),
          }),
        }).catch(function (err) {
          console.log(err);
        });
      } catch (err) {
        console.log(err);
      }
    });
    (0, _defineProperty2.default)(this, 'handleMessages', message => {
      if (
        message.type === 'IMPORT' ||
        (message.type === 'SYNC' &&
          this.socket.id &&
          message.id !== this.socket.id)
      ) {
        this.store.liftedStore.dispatch({
          type: 'IMPORT_STATE',

          nextLiftedState: (0, _jsan.parse)(message.state),
        });
      } else if (message.type === 'UPDATE') {
        this.relay('STATE', this.getLiftedState());
      } else if (message.type === 'START') {
        this.isMonitored = true;
        if (typeof this.actionCreators === 'function') {
          this.actionCreators = this.actionCreators();
        }
        this.relay('STATE', this.getLiftedState(), this.actionCreators);
      } else if (message.type === 'STOP' || message.type === 'DISCONNECTED') {
        this.isMonitored = false;
        this.relay('STOP');
      } else if (message.type === 'ACTION') {
        this.dispatchRemotely(message.action);
      } else if (message.type === 'DISPATCH') {
        this.store.liftedStore.dispatch(message.action);
      }
    });
    (0, _defineProperty2.default)(this, 'sendError', errorAction => {
      // Prevent flooding
      if (errorAction.message && errorAction.message === this.lastErrorMsg) {
        return;
      }
      this.lastErrorMsg = errorAction.message;
      async(() => {
        this.store.dispatch(errorAction);
        if (!this.started) {
          this.send();
        }
      });
    });
    (0, _defineProperty2.default)(this, 'stop', keepConnected => {
      this.started = false;
      this.isMonitored = false;
      if (!this.socket) {
        return;
      }
      void this.socket.unsubscribe(this.channel);
      this.socket.closeChannel(this.channel);
      if (!keepConnected) {
        this.socket.disconnect();
      }
    });
    (0, _defineProperty2.default)(this, 'start', () => {
      if (
        this.started ||
        (this.socket && this.socket.getState() === this.socket.CONNECTING)
      ) {
        return;
      }
      this.socket = _socketclusterClient.default.create(this.socketOptions);
      void (async () => {
        let consumer = this.socket.listener('error').createConsumer();
        while (true) {
          const {value: data, done} = await consumer.next();
          if (done) {
            break;
          }

          // for await (const data of this.socket.listener('error')) {
          // if we've already had this error before, increment it's counter, otherwise assign it '1' since we've had the error once.

          this.errorCounts[data.error.name] = this.errorCounts.hasOwnProperty(
            data.error.name,
          )
            ? this.errorCounts[data.error.name] + 1
            : 1;
          if (this.suppressConnectErrors) {
            if (this.errorCounts[data.error.name] === 1) {
              console.log(
                'remote-redux-devtools: Socket connection errors are being suppressed. ' +
                  '\n' +
                  "This can be disabled by setting suppressConnectErrors to 'false'.",
              );
              console.log(data.error);
            }
          } else {
            console.log(data.error);
          }
        }
      })();
      void (async () => {
        let consumer = this.socket.listener('connect').createConsumer();
        while (true) {
          const {value: data, done} = await consumer.next();
          if (done) {
            break;
          }

          // for await (const data of this.socket.listener('connect')) {
          console.log('connected to remotedev-server');
          this.errorCounts = {}; // clear the errorCounts object, so that we'll log any new errors in the event of a disconnect
          this.login();
        }
      })();
      void (async () => {
        let consumer = this.socket.listener('disconnect').createConsumer();
        while (true) {
          const {value: data, done} = await consumer.next();
          if (done) {
            break;
          }

          // for await (const data of this.socket.listener('disconnect')) {
          this.stop(true);
        }
      })();
    });
    (0, _defineProperty2.default)(this, 'checkForReducerErrors', function () {
      let liftedState =
        arguments.length > 0 && arguments[0] !== undefined
          ? arguments[0]
          : _this.getLiftedStateRaw();
      if (liftedState.computedStates[liftedState.currentStateIndex].error) {
        if (_this.started) {
          _this.relay(
            'STATE',
            (0, _utils.filterStagedActions)(liftedState, _this.filters),
          );
        } else {
          _this.send();
        }
        return true;
      }
      return false;
    });
    (0, _defineProperty2.default)(this, 'monitorReducer', function () {
      let state =
        arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      let action = arguments.length > 1 ? arguments[1] : undefined;
      _this.lastAction = action.type;
      if (
        !_this.started &&
        _this.sendOnError === 2 &&
        _this.store.liftedStore
      ) {
        async(_this.checkForReducerErrors);
      } else if (action.action) {
        if (
          _this.startOn &&
          !_this.started &&
          _this.startOn.indexOf(action.action.type) !== -1
        ) {
          async(_this.start);
        } else if (
          _this.stopOn &&
          _this.started &&
          _this.stopOn.indexOf(action.action.type) !== -1
        ) {
          async(_this.stop);
        } else if (
          _this.sendOn &&
          !_this.started &&
          _this.sendOn.indexOf(action.action.type) !== -1
        ) {
          async(_this.send);
        }
      }
      return state;
    });
    (0, _defineProperty2.default)(this, 'enhance', function () {
      let options =
        arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      _this.init({
        ...options,
        hostname: (0, _rnHostDetect.default)(options.hostname || 'localhost'),
      });
      const realtime =
        typeof options.realtime === 'undefined'
          ? process.env.NODE_ENV === 'development'
          : options.realtime;
      if (!realtime && !(_this.startOn || _this.sendOn || _this.sendOnError)) {
        return f => f;
      }
      const maxAge = options.maxAge || 30;
      return next => {
        return (reducer, initialState) => {
          _this.store = (0, _configureStore.default)(
            next,
            _this.monitorReducer,
            {
              maxAge,
              trace: options.trace,
              traceLimit: options.traceLimit,
              shouldCatchErrors: !!_this.sendOnError,
              shouldHotReload: options.shouldHotReload,
              shouldRecordChanges: options.shouldRecordChanges,
              shouldStartLocked: options.shouldStartLocked,
              pauseActionType: options.pauseActionType || '@@Paused',
            },
          )(reducer, initialState);
          if (realtime) {
            _this.start();
          }
          _this.store.subscribe(() => {
            if (_this.isMonitored) {
              _this.handleChange(
                _this.store.getState(),
                _this.getLiftedStateRaw(),
                maxAge,
              );
            }
          });
          return _this.store;
        };
      };
    });
  }
  getLiftedStateRaw() {
    return this.store.liftedStore.getState();
  }
  getLiftedState() {
    return (0, _utils.filterStagedActions)(
      this.getLiftedStateRaw(),
      this.filters,
    );
  }
  relay(type, state, action, nextActionId) {
    const message = {
      type,

      id: this.socket.id,
      name: this.instanceName,
      instanceId: this.appInstanceId,
    };
    if (state) {
      message.payload =
        type === 'ERROR'
          ? state
          : (0, _jsan.stringify)(
              (0, _utils.filterState)(
                state,
                type,
                this.filters,
                this.stateSanitizer,
                this.actionSanitizer,
                nextActionId,
              ),
            );
    }
    if (type === 'ACTION') {
      message.action = (0, _jsan.stringify)(
        !this.actionSanitizer
          ? action
          : this.actionSanitizer(action.action, nextActionId - 1),
      );
      message.isExcess = this.isExcess;
      message.nextActionId = nextActionId;
    } else if (action) {
      message.action = action;
    }

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
  init(options) {
    this.instanceName = options.name;
    this.appInstanceId = getRandomId();
    const {blacklist, whitelist, denylist, allowlist} = options.filters || {};
    this.filters = (0, _utils.getLocalFilter)({
      actionsDenylist:
        denylist ??
        options.actionsDenylist ??
        blacklist ??
        options.actionsBlacklist,
      actionsAllowlist:
        allowlist ??
        options.actionsAllowlist ??
        whitelist ??
        options.actionsWhitelist,
    });
    if (options.port) {
      this.socketOptions = {
        port: options.port,
        hostname: options.hostname || 'localhost',
        secure: options.secure,
      };
    } else {
      this.socketOptions = _constants.defaultSocketOptions;
    }
    this.suppressConnectErrors =
      options.suppressConnectErrors !== undefined
        ? options.suppressConnectErrors
        : true;
    this.startOn = str2array(options.startOn);
    this.stopOn = str2array(options.stopOn);
    this.sendOn = str2array(options.sendOn);
    this.sendOnError = options.sendOnError;
    if (this.sendOn || this.sendOnError) {
      this.sendTo =
        options.sendTo ||
        `${this.socketOptions.secure ? 'https' : 'http'}://${
          this.socketOptions.hostname
        }:${this.socketOptions.port}`;
      this.instanceId = options.id;
    }
    if (this.sendOnError === 1) {
      (0, _utils.catchErrors)(this.sendError);
    }
    if (options.actionCreators) {
      this.actionCreators = () =>
        (0, _utils.getActionsArray)(options.actionCreators);
    }
    this.stateSanitizer = options.stateSanitizer;
    this.actionSanitizer = options.actionSanitizer;
  }
  login() {
    void (async () => {
      try {
        const channelName = await this.socket.invoke('login', 'master');
        this.channel = channelName;
        let consumer = this.socket.subscribe(channelName).createConsumer();
        while (true) {
          const {value: data, done} = await consumer.next();
          if (done) {
            break;
          }

          // for await (const data of this.socket.subscribe(channelName)) {
          this.handleMessages(data);
        }
      } catch (error) {
        console.log(error);
      }
    })();
    this.started = true;
    this.relay('START');
  }

  handleChange(state, liftedState, maxAge) {
    if (this.checkForReducerErrors(liftedState)) {
      return;
    }
    if (this.lastAction === 'PERFORM_ACTION') {
      const nextActionId = liftedState.nextActionId;
      const liftedAction = liftedState.actionsById[nextActionId - 1];
      if ((0, _utils.isFiltered)(liftedAction.action, this.filters)) {
        return;
      }
      this.relay('ACTION', state, liftedAction, nextActionId);
      if (!this.isExcess && maxAge) {
        this.isExcess = liftedState.stagedActionIds.length >= maxAge;
      }
    } else {
      if (this.lastAction === 'JUMP_TO_STATE') {
        return;
      }
      if (this.lastAction === 'PAUSE_RECORDING') {
        this.paused = liftedState.isPaused;
      } else if (this.lastAction === 'LOCK_CHANGES') {
        this.locked = liftedState.isLocked;
      }
      if (this.paused || this.locked) {
        if (this.lastAction) {
          this.lastAction = undefined;
        } else {
          return;
        }
      }
      this.relay(
        'STATE',
        (0, _utils.filterStagedActions)(liftedState, this.filters),
      );
    }
  }
}
var _default = options => new DevToolsEnhancer().enhance(options);
exports.default = _default;
const compose = options =>
  function () {
    for (
      var _len = arguments.length, funcs = new Array(_len), _key = 0;
      _key < _len;
      _key++
    ) {
      funcs[_key] = arguments[_key];
    }
    return function () {
      const devToolsEnhancer = new DevToolsEnhancer();
      function preEnhancer(createStore) {
        return (reducer, preloadedState) => {
          devToolsEnhancer.store = createStore(reducer, preloadedState);
          return {
            ...devToolsEnhancer.store,
            dispatch: action =>
              devToolsEnhancer.locked
                ? action
                : devToolsEnhancer.store.dispatch(action),
          };
        };
      }
      for (
        var _len2 = arguments.length, args = new Array(_len2), _key2 = 0;
        _key2 < _len2;
        _key2++
      ) {
        args[_key2] = arguments[_key2];
      }
      return [preEnhancer, ...funcs].reduceRight(
        (composed, f) => f(composed),
        devToolsEnhancer.enhance(options)(...args),
      );
    };
  };
function composeWithDevTools() {
  for (
    var _len3 = arguments.length, funcs = new Array(_len3), _key3 = 0;
    _key3 < _len3;
    _key3++
  ) {
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