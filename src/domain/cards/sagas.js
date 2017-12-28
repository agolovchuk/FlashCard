import { call, put, select } from 'redux-saga/effects';
import I from 'immutable';
import Api, { ensure } from 'domain/api';
import * as selector from './cardsSelector';
import * as action from './cardsActions';
import * as Storage from 'lib/indexedStorage';
import {
  cardItemImSerialize,
  cadsToLexiconSerialize,
  lexiconItemImSerialize, cardItemDeSerialize,
} from './helpers';

export { action, selector } ;

export const ensureGetDictionary = ensure({
  api: Api.ajaxGet,
  action: action.getDictionary,
  serializer: (data, set) => ({
    payload: data.match(/[^\r\n]+/g).map(e => ({ key: e })),
    set,
  }),
}, 'set');

export function* ensureGetCard({ cardId }) {
  const card = yield call(
    Storage.getItem,
    Storage.TABLE.DICTIONARY,
    'index',
    parseInt(cardId, 10),
  );
  if (typeof card !== 'undefined') {
    const set = (yield checkCardSets(card.index)).setIn(['meta', 'current'], card.index);
    yield call(ensureUpdateSets, set);
    yield put({
      type: action.getDictItem.success,
      payload: cardItemImSerialize(card).set('set', set),
    });
  }
}


export function* checkCardSets(index) {

  const sets = yield select(selector.setsList);

  const check = function(e) {
    return e.getIn(['meta', 'first']) <= index && index <= e.getIn(['meta', 'last']);
  };

  return sets
    .filter(e => e.get('isLoaded'))
    .reduce((A, V) => {
      if (A.size) return A;
      return check(V) ? V : A;
    }, new I.Map());

}

export function* ensureUpdateCard({ payload }) {
  yield call(Storage.updateItem, Storage.TABLE.DICTIONARY, cardItemDeSerialize(payload));
  const lexicon = yield select(selector.lexiconKeys);
  const isInclude = lexicon.includes(payload.key);
  if (payload.to_set && !isInclude) {
    yield call(ensureAddToLexicon, { card: cardItemImSerialize(payload) });
  }
  yield put({
    type: action.editCard.success,
    payload,
  });
}

export function* ensureAddToLexicon({ card }) {
  const lexicon = cadsToLexiconSerialize(card || (yield select(selector.cardItem)));
  const key = yield call(Storage.addData, Storage.TABLE.LEXICON, lexicon);
  yield put({
    type: action.addToLexicon.success,
    key,
    payload: lexiconItemImSerialize(lexicon),
  });
}

export function* ensureRemoveFromLexicon({ payload }) {
  const key = payload.get('key');
  yield call(Storage.deleteItem, Storage.TABLE.LEXICON, key);
  yield put({
    type: action.removeFromLexicon.success,
    key,
  });
}

export function* ensureUpdateSets(data) {
  yield call(Storage.updateItem, Storage.TABLE.SETS, data.toJS());
  yield put({
    type: action.updateSet.success,
    id: data.get('id'),
    payload: data,
  });
}