import { Options } from '@redux-devtools/instrument';
import { Action, Reducer, StoreEnhancerStoreCreator } from 'redux';
export default function configureStore<S, A extends Action<string>, MonitorState, MonitorAction extends Action<string>>(next: StoreEnhancerStoreCreator<{}, unknown>, subscriber: Reducer<MonitorState, MonitorAction>, options: Options<S, A, MonitorState, MonitorAction>): StoreEnhancerStoreCreator<import("@redux-devtools/instrument").InstrumentExt<any, any, MonitorState>, {}>;
