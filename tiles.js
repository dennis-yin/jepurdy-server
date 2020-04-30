const { db } = require("./config");
const { addViewedProperty } = require("./helpers");
const {
  NUM_CATEGORIES,
  ROUND_ONE,
  ROUND_TWO,
  ROUND_THREE,
  ROUND_ONE_VALUES,
  ROUND_TWO_VALUES,
} = require("./constants");

const getCategory = async (round) => {
  try {
    const category = await db.query(
      "SELECT * FROM (SELECT DISTINCT category FROM questions WHERE round = $1) AS categories ORDER BY random() LIMIT 1",
      [round]
    );

    console.log("Got the category", category);
    return category.rows[0];
  } catch (err) {
    console.log("Couldn't retrieve data");
    throw err;
  }
};

const getCategories = async (round) => {
  const categories = [];
  for (let i = 0; i < NUM_CATEGORIES; i++) {
    let category;
    while (!category) {
      category = await getCategory(round);
    }
    categories.push(category);
  }
  return categories;
};

const getTilesByCategory = async (category, round) => {
  const values = round === ROUND_ONE ? ROUND_ONE_VALUES : ROUND_TWO_VALUES;

  const arrayOfPromises = values.map(async (value) => {
    const tile = await db.query(
      "SELECT * FROM questions WHERE category = $1 AND value = $2 AND round = $3 ORDER BY random() LIMIT 1",
      [category, value, round]
    );

    // If the tile is a Daily Double then its value is not likely to be one of the 'normal' values. This code block queries for a tile with the same category and round, but with an irregular value, and sets its value appropriately
    if (tile.rows.length === 0) {
      const dailyDouble = await db.query(
        "SELECT * FROM questions WHERE category = $1 AND value NOT IN ($2, $3, $4, $5, $6) AND round = $7 ORDER BY random() LIMIT 1",
        [category, ...values, round]
      );

      if (dailyDouble.rows[0]) {
        dailyDouble.rows[0]["value"] = value;
        return dailyDouble.rows[0];
      }
    } else {
      return tile.rows[0];
    }
  });

  const tiles = await Promise.all(arrayOfPromises);

  return tiles;
};

const getRoundThreeTile = async () => {
  const tile = await db.query(
    "SELECT * FROM QUESTIONS WHERE round = $1 ORDER BY RANDOM() LIMIT 1",
    [ROUND_THREE]
  );

  return tile.rows[0];
};

// TODO: DRY it up
const getAllTiles = async () => {
  const roundOneCategories = await getCategories(ROUND_ONE);
  const roundOnePromises = roundOneCategories.map(async ({ category }) => {
    const tiles = await getTilesByCategory(category, ROUND_ONE);

    // If a tile is missing, get tiles from a different category
    if (tiles.includes(undefined)) {
      const { category } = await getCategory(ROUND_ONE);
      const newTiles = await getTilesByCategory(category, ROUND_ONE);
      return newTiles;
    } else {
      return tiles;
    }
  });
  const roundOne = addViewedProperty(await Promise.all(roundOnePromises));

  const roundTwoCategories = await getCategories(ROUND_TWO);
  const roundTwoPromises = roundTwoCategories.map(async ({ category }) => {
    const tiles = await getTilesByCategory(category, ROUND_TWO);

    if (tiles.includes(undefined)) {
      const { category } = await getCategory(ROUND_TWO);
      const newTiles = await getTilesByCategory(category, ROUND_TWO);
      return newTiles;
    } else {
      return tiles;
    }
  });
  const roundTwo = addViewedProperty(await Promise.all(roundTwoPromises));

  const roundThree = await getRoundThreeTile();

  return {
    roundOne: roundOne,
    roundTwo: roundTwo,
    roundThree: [roundThree],
  };
};

module.exports = { getAllTiles };
