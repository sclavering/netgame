// babel --no-comments -w *.jsx --out-dir .


const create_grid_functions = {};


function new_grid(settings) {
  const grid = create_grid_functions[settings.shape](settings.width, settings.height, settings.wrap);
  fill_grid(grid);
  for(let tile of grid.tiles) tile.num_distinct_rotations = Grid.calculate_num_distinct_rotations(tile);
  // Walls are just hints, added after grid filling to make it easier to solve.
  if(settings.wall_probability) for(let tile of grid.tiles) Grid.add_walls(tile, settings.wall_probability);
  return grid;
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
    tile.links[random_dir] = true;
    tile.adj[random_dir].links[Grid.invert_direction(tile, random_dir)] = true;
    linked[tile.id] = true;

    for(let adj of tile.adj) {
      if(!adj || linked[adj.id] || fringe_set[adj.id]) continue;
      fringe.push(adj);
      fringe_set[adj.id] = true;
    }
  }

  for(let tile of grid.tiles) tile.is_leaf_node = tile.links.filter(x => x).length === 1;

  return grid;
}


function random_int(max) {
  var r;
  do { r = Math.random(); } while(r == 1.0);
  return Math.floor(r * max);
}


const Grid = {
  generate_grid: function(shape, num_sides, width, height, adjacents_func) {
    const tile_grid = new Array(width);
    let id = 0;
    for(let x = 0; x !== width; ++x) {
      tile_grid[x] = new Array(height);
      for(let y = 0; y !== height; ++y) tile_grid[x][y] = this.new_tile(num_sides, id++, x, y);
    }
    for(let x = 0; x !== width; ++x) {
      for(let y = 0; y !== height; ++y) {
        let tile = tile_grid[x][y];
        adjacents_func(tile.x, tile.y).forEach(function(tmp) {
          if(!tmp) return;
          const [dir, x, y] = tmp;
          const other = (tile_grid[x] && tile_grid[x][y]) || null;
          if(!other) return;
          tile.adj[dir] = other;
          other.adj[Grid.invert_direction(tile, dir)] = tile;
        });
      }
    }
    const source = tile_grid[Math.floor(width / 2)][Math.floor(height / 2)];
    source.is_source = true;
    return {
      shape: shape,
      width: width,
      height: height,
      tiles: Array.concat.apply(null, tile_grid),
      source_tile: source,
    };
  },

  // { orientations: (id => int mapping), active: (int => bool set) }
  initial_state_randomising_orientations: function(grid) {
    const orientations = {};
    let num_tiles_originally_requiring_rotation = 0;
    for(let tile of grid.tiles) {
      let orient = orientations[tile.id] = random_int(tile.num_sides);
      if(orient % tile.num_distinct_rotations) ++num_tiles_originally_requiring_rotation;
    }
    return this._update_powered_set(grid, {
      orientations: orientations,
      powered_set: null,
      locked_set: {},
      num_tiles_originally_requiring_rotation: num_tiles_originally_requiring_rotation,
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
      num_distinct_rotations: 0, // Either num_sides, or lower if the tile is rotationally symmetrical.
      // Other tile objects, indexed by shape-specific directions.
      adj: Array(num_sides).fill(null),
      // Does the tile, when in its correct orientation, have links to the tiles at the corresponding indexes of .adj
      links: Array(num_sides).fill(0),
      // Does the tile have just one link?
      is_leaf_node: false,
    };
  },

  calculate_num_distinct_rotations: function(tile) {
    const needle = tile.links.map(x => x ? 1 : 0).join("");
    const haystack = needle.slice(1) + needle.slice(0, -1);
    const ix = haystack.indexOf(needle);
    if(ix === -1) return tile.num_sides;
    return ix + 1;
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
  return Grid.generate_grid("sqr", 4, width, height, (x, y) => [
    x ? [3, x - 1, y] : wrap ? [3, width - 1, y] : null,
    y ? [0, x, y - 1] : wrap ? [0, x, height - 1] : null,
  ]);
};


// Tile directions are 0:upleft 1:up 2:upright 3:downright 4:down 5:downleft
create_grid_functions.hex = function(width, height, wrap) {
  if(wrap) {
    if(height % 2) ++height;
    if(width % 2) ++width;
  }
  return Grid.generate_grid("hex", 6, width, height, (x, y) => {
    let slope_up_y = x % 2 ? y - 1 : y;
    if(slope_up_y === -1 && wrap) slope_up_y = height - 1;
    return [
      [0, !x && wrap ? width - 1 : x - 1, slope_up_y],
      [1, x, !y && wrap ? height - 1 : y - 1],
      [2, wrap && x === width - 1 ? 0 : x + 1, slope_up_y],
    ];
  });
};
