const db = require("./dbConfig.js");

module.exports = {
    insertRecipe,
    allRecipes,
    findRecipeById,
    findByTitle    
}


async function insertRecipe({
  steps, ingredients, ancestor, innovator, categories, ...recipesEntry}) {

  // main entry needed first
  const recipeRes = await db('recipes').insert(recipesEntry, ['id']);

  const recipeId = recipeRes[0].id;
  console.log('first', recipeRes[0])
  console.log(recipeId) // == 5

  const stepsEntries = steps.map((step, i) => {
    console.log('steps recipeId', recipeId)
    return { ordinal: i, body: step, recipe_id: recipeId };
  });

  // ingredients given as array
  console.log(ingredients)
  const ingredientsEntries = await Promise.all(
    ingredients.map(async ({ name, quantity, unit }) => {
    const unitRes = await db('units').where({ name: unit }).first()
    const unitId = unitRes.name;
    console.log('ingredients recipeId', recipeId);
    console.log('unitId', unitId);
    return {
      recipe_id: recipeId,
      name,
      unit: unitId,
      quantity
    };
  }));

  // // for ingredients given as object
  // const ingredientsEntries = Object.entries(ingredients).map(async ([name, props]) => {
  //   const { quantity, unit } = props;
  //   const unitId = await db('units').where({ name }).first();
  //   return {
  //     recipe_id: recipeId,
  //     name,
  //     unit_id: unitId,
  //     quantity
  //   };
  // });

  console.log('ingredientsEntries', ingredientsEntries)
  await db('ingredients').insert(ingredientsEntries);
  await db('steps').insert(stepsEntries);
  await db('categories').insert(categories);
  await db('edits').insert({
    cook_id: innovator,
    old_recipe: ancestor, // can be null
    new_recipe: recipeId
    // timestamp: Date.now() // for the future
  });

  return recipeId;
}
  
async function findRecipeById(id) {

    //resolves to recipe table with only title, minutes to make, and notes.
  const baseRecipe = await db('recipes as r')
    .where({ 'r.id': id })
    .first();

    //resolves to array of step objects with their ordinals and step-body, ordered by ordinal
  const recipeSteps = await db('recipes as r')
    .where({ 'r.id': id })
    .join('steps as s', 's.recipe_id', 'r.id')
    .select('s.ordinal', 's.body').whereIn('s.recipe_id', [id])
    .orderBy('s.ordinal');

    //resolves to an array of ingredient objects with name, quantity, and unit type
  const recipeIngredients = await db('recipes as r')
    .where({ 'r.id': id })
    .join('ingredients as i', 'i.recipe_id', 'r.id')
    .select('i.name', 'i.quantity', 'i.unit').whereIn('i.recipe_id', [id]);

    //resolves to array of cook_ids.  will have to call likes.length in final return object.
  const recipeLikes = await db('recipes as r')
    .where({ 'r.id': id })
    .join('likes as l', 'l.recipe_id', 'r.id')
    .pluck('l.cook_id').whereIn('l.recipe_id', [id]);

    // resolves to the id of whichever cook created or modified this recipe.
  const recipeInnovator = await db('recipes as r')
    .where({ 'r.id': id })
    .join('edits as e', 'e.new_recipe', 'r.id')
    .select('e.cook_id').whereIn('e.new_recipe', [id])
    .first();

  const innovatorEntry = await db('cooks')
        .where({ id: recipeInnovator.cook_id })
        .select('username')
        .first();

    // resolves to the id of the previous version of this recipe, if any. and null, if not.
  const recipeAncestor = await db('recipes as r')
    .where({ 'r.id': id })
    .join('edits as e', 'e.new_recipe', 'r.id')
    .select('e.old_recipe').whereIn('e.new_recipe', [id])
    .first();

    //resolves to an array of category names as strings
  const recipeCategories = await db('recipes as r')
    .where({ 'r.id': id })
    .join('categories as c', 'c.recipe_id', 'r.id')
    .pluck('c.name').whereIn('c.recipe_id', [id]);

    //constructs the expected response object
  const newRecipe = {
      id: baseRecipe.id,
      title: baseRecipe.title,
      minutes: baseRecipe.minutes,
      img: baseRecipe.img,
      ingredients: recipeIngredients,
      steps: recipeSteps,
      notes: baseRecipe.notes ? baseRecipe.notes : null,
      categories: recipeCategories ? recipeCategories : null,
      likes: recipeLikes ? recipeLikes.length : null,
      innovator: recipeInnovator ? recipeInnovator.cook_id : null,
      ancestor: recipeAncestor ? recipeAncestor.old_recipe : null,
      innovator_name: innovatorEntry.username ? innovatorEntry.username : null
  }

  return newRecipe;
}

  function allRecipes() {
    return db('*').from('recipes as r')
        .leftJoin('edits as e', {'e.new_recipe': 'r.id'})
        .leftJoin('cooks as c', 'e.cook_id', 'c.id')
        .select(['r.id', 'r.title', 'r.minutes', 'r.img', 'e.cook_id', 'c.username']);
  }

  function findByTitle(title) {
    return db("recipes as r").where('title', 'ilike', `%${title}%`)
        .leftJoin('edits as e', {'e.new_recipe': 'r.id'})
        .leftJoin('cooks as c', 'e.cook_id', 'c.id')
        .select(['r.id', 'r.title', 'r.minutes', 'r.img', 'e.cook_id', 'c.username']);
  }
