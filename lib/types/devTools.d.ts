import { Action, ActionCreator, StoreEnhancer, StoreEnhancerStoreCreator } from 'redux';
interface Filters {
    /**
     * @deprecated Use actionsDenylist instead.
     */
    readonly blacklist?: string | readonly string[];
    /**
     * @deprecated Use actionsAllowlist instead.
     */
    readonly whitelist?: string | readonly string[];
    readonly denylist?: string | readonly string[];
    readonly allowlist?: string | readonly string[];
}
interface Options<S, A extends Action<string>> {
    readonly hostname?: string;
    readonly realtime?: boolean;
    readonly maxAge?: number;
    readonly trace?: boolean | ((action: A) => string | undefined);
    readonly traceLimit?: number;
    readonly shouldHotReload?: boolean;
    readonly shouldRecordChanges?: boolean;
    readonly shouldStartLocked?: boolean;
    readonly pauseActionType?: unknown;
    readonly name?: string;
    readonly filters?: Filters;
    /**
     * @deprecated Use actionsDenylist instead.
     */
    readonly actionsBlacklist?: string | readonly string[];
    /**
     * @deprecated Use actionsAllowlist instead.
     */
    readonly actionsWhitelist?: string | readonly string[];
    readonly actionsDenylist?: string | readonly string[];
    readonly actionsAllowlist?: string | readonly string[];
    readonly port?: number;
    readonly secure?: boolean;
    readonly suppressConnectErrors?: boolean;
    readonly startOn?: string | readonly string[];
    readonly stopOn?: string | readonly string[];
    readonly sendOn?: string | readonly string[];
    readonly sendOnError?: number;
    readonly sendTo?: string;
    readonly id?: string;
    readonly actionCreators?: {
        [key: string]: ActionCreator<Action<string>>;
    };
    readonly stateSanitizer?: ((state: S, index?: number) => S) | undefined;
    readonly actionSanitizer?: (<A extends Action<string>>(action: A, id?: number) => A) | undefined;
}
declare const _default: <S, A extends Action<string>>(options?: Options<S, A>) => StoreEnhancer;
export default _default;
export declare function composeWithDevTools(...funcs: [Options<unknown, Action<string>>] | StoreEnhancer[]): StoreEnhancer | ((...funcs: StoreEnhancer[]) => (...args: unknown[]) => StoreEnhancerStoreCreator<{}, {}>) | ((...args: unknown[]) => StoreEnhancerStoreCreator<{}, {}>);
