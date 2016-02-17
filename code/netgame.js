const create_grid_functions = {};


window.onload = function() {
  new_grid('sqr', 9, 9, true, 0.6);
}


function do_new_game(form) {
  function v(sel) { return sel.options[sel.selectedIndex].value; }
  new_grid(v(form['shape']), +v(form['width']), +v(form['height']), form['wrap'].checked, +v(form['walls']));
  return false;
}


function new_grid(shape, width, height, wrap, wall_probability) {
  const grid = create_grid_functions[shape](width, height, wrap);
  fill_grid(grid);
  // Walls are just hints, added after grid filling to make it easier to solve.
  if(wall_probability) for(let tile of grid.tiles) Grid.add_walls(tile, wall_probability);
  show_game(grid);
}


function fill_grid(grid) {
  const source = grid.source_tile;
  const linked = {};
  linked[source.id] = true;

  const fringe = [];
  const fringe_set = {};
  for(let fr of source.adj) {
    if(!fr) continue;
    fringe.push(fr);
    fringe_set[fr.id] = true;
  }

  // Repeatedly pick a random tile from the fringe, link it into the network, and add its unlinked adjacents to the fringe.
  for(var num = fringe.length; num; num = fringe.length) {
    var tile = fringe.splice(random_int(num), 1)[0];

    var adjs = tile.adj, len = adjs.length;
    var linked_adj_ixs = [];
    for(var i = 0; i != len; ++i) {
      var adj = adjs[i];
      if(adj && linked[adj.id]) linked_adj_ixs.push(i);
    }

    var random_dir = linked_adj_ixs[random_int(linked_adj_ixs.length)];
    tile.links[random_dir] = 1;
    tile.adj[random_dir].links[Grid.invert_direction(tile, random_dir)] = 1;
    linked[tile.id] = true;

    for(let adj of tile.adj) {
      if(!adj || linked[adj.id] || fringe_set[adj.id]) continue;
      fringe.push(adj);
      fringe_set[adj.id] = true;
    }
  }

  return grid;
}


function random_int(max) {
  var r;
  do { r = Math.random(); } while(r == 1.0);
  return Math.floor(r * max);
}


function sum(list) {
  var x = 0, len = list.length;
  for(var i = 0; i != len; ++i) x += list[i];
  return x;
}


function connect_to(tile_grid, tile, dir, x, y) {
  const other = (tile_grid[x] && tile_grid[x][y]) || null;
  if(!other) return;
  tile.adj[dir] = other;
  other.adj[Grid.invert_direction(tile, dir)] = tile;
}


const Grid = {
  // { orientations: (id => int mapping), active: (int => bool set) }
  initial_state_randomising_orientations: function(grid) {
    const orientations = {};
    for(let tile of grid.tiles) orientations[tile.id] = random_int(tile.num_sides);
    return this._update_powered_set(grid, {
      orientations: orientations,
      powered_set: null,
      locked_set: {},
    });
  },

  _update_powered_set: function(grid, mutable_new_state) {
    // Rotating a tile can power/depower abitrarily many others.  And there can be cycles in an unfinished puzzle.  So there's probably no cleverer way of doing this than just recalculating the set from scratch;
    const orientations = mutable_new_state.orientations;
    const powered = mutable_new_state.powered_set = {};
    const queue = [grid.source_tile];
    const num_sides = grid.source_tile.num_sides;
    for(let i = 0; i < queue.length; ++i) {
      let tile = queue[i];
      powered[tile.id] = true;
      for(let dir = 0; dir !== num_sides; ++dir) {
        let adj = tile.adj[dir];
        if(!adj || powered[adj.id]) continue;
        if(!this._has_current_link_to(orientations, tile, dir)) continue;
        if(!this._has_current_link_to(orientations, tile.adj[dir], this.invert_direction(tile, dir))) continue;
        queue.push(adj);
      }
    }
    return mutable_new_state;
  },

  lock_or_unlock_tile: function(grid, grid_state, tile) {
    const new_locked_set = Object.assign({}, grid_state.locked_set);
    if(grid_state.locked_set[tile.id]) delete new_locked_set[tile.id];
    else new_locked_set[tile.id] = true;
    return Object.assign({}, grid_state, { locked_set: new_locked_set });
  },

  rotate_tile_clockwise: function(grid, grid_state, tile) {
    const tile_new_orientation = this._clamp(tile, grid_state.orientations[tile.id] + 1);
    const new_orientations = Object.assign({}, grid_state.orientations);
    new_orientations[tile.id] = tile_new_orientation;
    const new_grid_state = Object.assign({}, grid_state, { orientations: new_orientations });
    return this._update_powered_set(grid, new_grid_state);
  },

  _has_current_link_to: function(orientations, tile, dir) {
    return !!tile.links[this._clamp(tile, dir - orientations[tile.id])];
  },

  new_tile: function(num_sides, id, x, y) {
    return {
      id: id,
      x: x,
      y: y,
      is_source: false,
      num_sides: num_sides,
      // Other tile objects, indexed by shape-specific directions.
      adj: Array(num_sides).fill(null),
      // Does the tile, when in its correct orientation, have links to the tiles at the corresponding indexes of .adj
      links: Array(num_sides).fill(0),
    };
  },

  add_walls: function(tile, wall_probability) {
    const max = tile.num_sides;
    const links = tile.links, adj = tile.adj;
    for(let i = 0; i !== max; ++i) {
      if(tile.links[i] || !tile.adj[i]) continue;
      if(Math.random() > wall_probability) continue;
      tile.adj[i].adj[this.invert_direction(tile, i)] = null;
      tile.adj[i] = null;
    }
  },

  _clamp: function(tile, val) {
    const modulo = tile.num_sides;
    return (val + modulo) % modulo;
  },

  invert_direction: function(tile, dir) {
    const modulo = tile.num_sides;
    return (dir + modulo / 2) % modulo;
  },
};


// Tile directions are: 0:top 1:right 2:bottom 3:left
create_grid_functions.sqr = function(width, height, wrap) {
  const tiles = new Array(width);
  var id = 0;
  for(var x = 0; x != width; ++x) {
    tiles[x] = new Array(height);
    for(var y = 0; y != height; ++y) tiles[x][y] = Grid.new_tile(4, id++, x, y);
  }
  for(var x = 0; x != width; ++x) {
    for(var y = 0; y != height; ++y) {
      connect_to(tiles, tiles[x][y], 0, x, y - 1);
      connect_to(tiles, tiles[x][y], 3, x - 1, y);
    }
  }
  if(wrap) {
    for(var x = 0; x != width; ++x) connect_to(tiles, tiles[x][0], 0, x, height - 1);
    for(var y = 0; y != height; ++y) connect_to(tiles, tiles[0][y], 3, width - 1, y);
  }

  const source = tiles[Math.floor(width / 2)][Math.floor(height / 2)];
  source.is_source = true;

  return {
    view_width: width * sqr_size,
    view_height: height * sqr_size,
    tiles: Array.concat.apply(null, tiles),
    source_tile: source,
    bg_component: SquareBackground,
    tile_component: SquareTile,
    walls_component: SquareWalls,
  };
};


// Tile directions are 0:upleft 1:up 2:upright 3:downright 4:down 5:downleft
create_grid_functions.hex = function(width, height, wrap) {
  if(wrap) {
    if(height % 2) ++height;
    if(width % 2) ++width;
  }

  const tile_grid = new Array(width);
  var id = 0;
  for(var x = 0; x != width; ++x) {
    tile_grid[x] = new Array(height);
    for(var y = 0; y != height; ++y) tile_grid[x][y] = Grid.new_tile(6, id++, x, y);
  }
  for(var x = 0; x != width; ++x) {
    for(var y = 0; y != height; ++y) {
      var tile = tile_grid[x][y];
      connect_to(tile_grid, tile, 1, x, y - 1);
      var slope_up_y = x % 2 ? y - 1 : y;
      connect_to(tile_grid, tile, 0, x - 1, slope_up_y);
      connect_to(tile_grid, tile, 2, x + 1, slope_up_y);
    }
  }
  if(wrap) {
    for(var x = 0; x != width; ++x) connect_to(tile_grid, tile_grid[x][0], 1, x, height - 1);
    for(var y = 0; y != height; ++y) {
      connect_to(tile_grid, tile_grid[0][y], 0, width - 1, y);
      connect_to(tile_grid, tile_grid[0][y], 5, width - 1, y + 1);
    }
    connect_to(tile_grid, tile_grid[0][height - 1], 5, width - 1, 0);
  }

  const source = tile_grid[Math.floor(width / 2)][Math.floor(height / 2)];
  source.is_source = true;

  return {
    view_width: width * hex_hoffset + hex_overhang,
    view_height: height * hex_height + hex_half_height,
    tiles: Array.concat.apply(null, tile_grid),
    source_tile: source,
    bg_component: HexBackground,
    tile_component: HexTile,
    walls_component: HexWalls,
  };
};
