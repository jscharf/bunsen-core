import _ from 'lodash'
import immutable from 'seamless-immutable'
import {CHANGE_VALUE, VALIDATION_RESOLVED, CHANGE_MODEL} from './actions'
import evaluateConditions from './evaluate-conditions'
import {set, unset} from './immutable-utils'

const INITIAL_VALUE = {
  errors: {},
  validationResult: {warnings: [], errors: []},
  value: null,
  model: {}, // Model calculated by the reducer
  baseModel: {} // Original model recieved
}

export function initialState (state) {
  return _.defaults(state, INITIAL_VALUE)
}

/**
 * We want to go through a state.value object and pull out any references to null
 * @param {Object} value - our current value POJO
 * @returns {Object} a value cleaned of any `null`s
 */
function recursiveClean (value) {
  let output = {}
  if (_.isArray(value)) {
    output = []
  }
  _.forEach(value, (subValue, key) => {
    if (!_.isEmpty(subValue) || _.isNumber(subValue) || _.isBoolean(subValue)) {
      if (_.isObject(subValue) || _.isArray(subValue)) {
        output[key] = recursiveClean(subValue)
      } else {
        output[key] = subValue
      }
    }
  })
  return output
}

export const actionReducers = {
  '@@redux/INIT': function (state, action) {
    if (state && state.baseModel) {
      let initialValue = state.value || {}
      state.model = evaluateConditions(state.baseModel, recursiveClean(initialValue))
      // leave this undefined to force consumers to go through the proper CHANGE_VALUE channel
      // for value changes
      state.value = undefined
    }

    const newState = initialState(state || {})
    newState.value = immutable(newState.value)
    return newState
  },

  /**
   * Update the bunsen model
   * @param {State} state - state to update
   * @param {Action} action - action
   * @returns {State} - updated state
   */
  [CHANGE_MODEL]: function (state, action) {
    return _.defaults({
      baseModel: action.model,
      model: evaluateConditions(action.model, state.value)
    }, state)
  },

  /**
   * Update the bunsen value
   * @param {State} state - state to update
   * @param {Action} action - action
   * @returns {State} - updated state
   */
  [CHANGE_VALUE]: function (state, action) {
    const {value, bunsenId} = action
    let newValue

    if (bunsenId === null) {
      newValue = immutable(recursiveClean(value))
    } else {
      newValue = immutable(state.value)

      if (_.includes([null, ''], value) || (_.isArray(value) && value.length === 0)) {
        newValue = unset(newValue, bunsenId)
      } else {
        newValue = set(newValue, bunsenId, value)
      }
    }
    const newModel = evaluateConditions(state.baseModel, newValue)
    let model
    if (!_.isEqual(state.model, newModel)) {
      model = newModel
    } else {
      model = state.model
    }

    return _.defaults({
      value: immutable(newValue),
      model
    }, state)
  },

  /**
   * Update validation results
   * @param {State} state - state to update
   * @param {Action} action - action
   * @returns {State} - updated state
   */
  [VALIDATION_RESOLVED]: function (state, action) {
    return _.defaults({
      validationResult: action.validationResult,
      errors: action.errors
    }, state)
  }
}

/**
 * Update the state
 * @param {State} state - state to update
 * @param {Action} action - action
 * @returns {State} - updated state
 */
export function reducer (state, action) {
  if (action.type in actionReducers) {
    const actionReducer = actionReducers[action.type]
    return actionReducer(state, action)
  }

  // TODO: allow consumer to pass in logger class other than console
  console.error(`Do not recognize action ${action.type}`)

  return state
}

export default reducer
