import { instrument } from '@redux-devtools/instrument';
export default function configureStore(
// eslint-disable-next-line @typescript-eslint/ban-types
next, subscriber, options) {
  return instrument(subscriber, options)(next);
}