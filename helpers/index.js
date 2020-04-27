const addViewedProperty = (allTiles) => {
  return allTiles.map((category) =>
    category.map((tile) => ({ ...tile, viewed: false }))
  );
};

const getPlayerByID = (playerArr, playerID) => {
  return playerArr.find((player) => player.id === playerID);
};

const setTileToViewed = (allTiles, tileToUpdate) => {
  return allTiles.map((category) =>
    category.map((tile) => {
      if (tile.id === tileToUpdate.id) {
        tile.viewed = true;
      }
    })
  );
};

module.exports = { addViewedProperty, getPlayerByID, setTileToViewed };
