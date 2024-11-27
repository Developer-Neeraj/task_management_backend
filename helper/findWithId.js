const createError = require("http-errors");

const findWithId = async (Model, id, projection = {}) => {
  try {
    // Validate if the provided ID is a valid MongoDB ObjectId
    if (!Model.db.base.Types.ObjectId.isValid(id)) {
      throw createError(400, `Invalid ${Model.modelName} ID`);
    }

    // Find the document by ID with the specified projection
    const item = await Model.findById(id, projection);

    if (!item) {
      throw createError(404, `${Model.modelName} does not exist with this ID`);
    }

    return item;
  } catch (error) {
    throw error;
  }
};

module.exports = { findWithId };
