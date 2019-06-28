const mongoose = require('mongoose')
const Schema = mongoose.Schema
const ObjectId = Schema.Types.ObjectId

const authToken = new Schema({
  _id: ObjectId,
  token: { type: String, unique: true, required: true },
  expiryDate: { type: Date, required: true },
  isAuthenticated: { type: Boolean }
})

module.exports = mongoose.model('AuthToken', authToken)
