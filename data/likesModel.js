const db = require("./dbConfig.js");

module.exports = {
    likesInsert
}

function likesInsert(recipeId, cookId) {
    console.log("cook insert", recipeId, cookId)
    return db("likes")
        .insert({ recipe_id: recipeId, cook_id: cookId })
}