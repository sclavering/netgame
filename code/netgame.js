var svg = null;
var gridview = null;
const svg_templates = {};
const create_grid_functions = {};


window.onload = function() {
  svg = document.getElementById('gameview');
  for(let el of svg.getElementsByTagName('defs')[0].childNodes) {
    if(!el.id) continue;
    svg_templates[el.id] = el;
    el.removeAttribute('id'); // because we clone them
  }
  gridview = document.getElementById('gridview');
  new_grid('hex', 9, 9, true, 0.6);
}


function do_new_game(form) {
  function v(sel) { return sel.options[sel.selectedIndex].value; }
  new_grid(v(form['shape']), +v(form['width']), +v(form['height']), form['wrap'].checked, +v(form['walls']));
  return false;
}


const sqr_size = 50;
const sqr_half = 25;

const hex_height = 130;
const hex_half_height = 65;
const hex_half_width = 74;
const hex_hoffset = 111; // width of left point and rectangular body together
const hex_overhang = 37; // width of right point

const view = {
  _grid: null,

  show: function(grid) {
    this._grid = grid;
    if(this._grid_bg) ReactDOM.unmountComponentAtNode(this._grid_bg);
    if(this._grid_walls) ReactDOM.unmountComponentAtNode(this._grid_walls);
    while(gridview.hasChildNodes()) gridview.removeChild(gridview.lastChild);
    this._grid_bg = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this._grid_walls = document.createElementNS("http://www.w3.org/2000/svg", "g");
    gridview.appendChild(this._grid_bg);
    const vb = svg.viewBox.baseVal;
    vb.width = grid.view_width;
    vb.height = grid.view_height;
    // Draw each group of things separately for z-ordering
    const bg_element = React.createElement(GameBackground, { grid: grid, oncellclick: cell => this._onclick(cell) });
    ReactDOM.render(bg_element, this._grid_bg);
    for(let c of grid.cells) c.draw_fg();
    gridview.appendChild(this._grid_walls);
    const walls_element = React.createElement(GameWalls, { grid: grid });
    ReactDOM.render(walls_element, this._grid_walls);
    this.update_poweredness();
    const self = this;
    gridview.onclick = ev => {
      if(ev.target.__cell) this._onclick(ev.target.__cell);
    };
  },

  update_poweredness: function() {
    const powered_id_set = which_cells_are_powered(this._grid);
    for(let c of this._grid.cells) c.show_powered(c.id in powered_id_set);
  },

  _onclick: function(tile) {
    Grid.rotate_clockwise(tile);
    tile.redraw();
    this.update_poweredness();
  },
};


function new_grid(shape, width, height, wrap, wall_probability) {
  const grid = create_grid_functions[shape](width, height, wrap);
  fill_grid(grid);
  // Walls are just hints, added after grid filling to make it easier to solve.
  if(wall_probability) for(let c of grid.cells) Grid.add_walls(c, wall_probability);
  const max_rotation = grid.cells[0].adj.length;
  for(let c of grid.cells) c._rotation = random_int(max_rotation);
  view.show(grid);
}


function fill_grid(grid) {
  const source = grid.source_cell;
  const linked = {};
  linked[source.id] = true;

  const fringe = [];
  const fringe_set = {};
  for(let fr of source.adj) {
    if(!fr) continue;
    fringe.push(fr);
    fringe_set[fr.id] = true;
  }

  // Repeatedly pick a random cell from the fringe, link it into the network, and add its unlinked adjacents to the fringe.
  for(var num = fringe.length; num; num = fringe.length) {
    var cell = fringe.splice(random_int(num), 1)[0];

    var adjs = cell.adj, len = adjs.length;
    var linked_adj_ixs = [];
    for(var i = 0; i != len; ++i) {
      var adj = adjs[i];
      if(adj && linked[adj.id]) linked_adj_ixs.push(i);
    }

    var random_dir = linked_adj_ixs[random_int(linked_adj_ixs.length)];
    cell.links[random_dir] = 1;
    cell.adj[random_dir].links[Grid.invert_direction(cell, random_dir)] = 1;
    linked[cell.id] = true;

    for(let adj of cell.adj) {
      if(!adj || linked[adj.id] || fringe_set[adj.id]) continue;
      fringe.push(adj);
      fringe_set[adj.id] = true;
    }
  }

  return grid;
}


// Rotating a cell can power or depower abitrarily many others, so it doesn't make sense to store powered-ness as a property of the cell.  Instead, we build sets of powered node as-needed.
function which_cells_are_powered(grid) {
  const powered = {};
  const queue = [grid.source_cell];
  for(var i = 0; i < queue.length; ++i) {
    var cell = queue[i], adjs = cell.adj, len = adjs.length;
    powered[cell.id] = true;
    for(var dir = 0; dir !== len; ++dir) {
      var adj = adjs[dir];
      if(!adj || !Grid.has_current_bidirectional_link(cell, dir)) continue;
      if(powered[adj.id]) continue;
      queue.push(adj);
    }
  }
  return powered;
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


function add_transformed_clone(parent, template_id, transform) {
  const el = svg_templates[template_id].cloneNode(true);
  el.setAttribute('transform', transform);
  parent.appendChild(el);
  return el;
}


function connect_to(cell_grid, cell, dir, x, y) {
  const other = (cell_grid[x] && cell_grid[x][y]) || null;
  if(!other) return;
  cell.adj[dir] = other;
  other.adj[Grid.invert_direction(cell, dir)] = cell;
}


const Grid = {
  has_current_bidirectional_link: function(tile, dir) {
    return this.has_current_link_to(tile, dir) && this.has_current_link_to(tile.adj[dir], Grid.invert_direction(tile, dir));
  },

  has_current_link_to: function(tile, dir) {
    return !!tile.links[this._clamp(tile, dir - tile._rotation)];
  },

  rotate_clockwise: function(tile) {
    tile._rotation = this._clamp(tile, tile._rotation + 1);
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


create_grid_functions.sqr = function(width, height, wrap) {
  const cells = new Array(width);
  var id = 0;
  for(var x = 0; x != width; ++x) {
    cells[x] = new Array(height);
    for(var y = 0; y != height; ++y) cells[x][y] = Sqr.make(id++, x, y);
  }
  for(var x = 0; x != width; ++x) {
    for(var y = 0; y != height; ++y) {
      connect_to(cells, cells[x][y], 0, x, y - 1);
      connect_to(cells, cells[x][y], 3, x - 1, y);
    }
  }
  if(wrap) {
    for(var x = 0; x != width; ++x) connect_to(cells, cells[x][0], 0, x, height - 1);
    for(var y = 0; y != height; ++y) connect_to(cells, cells[0][y], 3, width - 1, y);
  }

  const source = cells[Math.floor(width / 2)][Math.floor(height / 2)];
  source.is_source = true;

  return {
    view_width: width * sqr_size,
    view_height: height * sqr_size,
    cells: Array.concat.apply(null, cells),
    source_cell: source,
    bg_component: SquareBackground,
    walls_component: SquareWalls,
  };
};

const Sqr = {
  make: function(id, x, y) {
    return {
      __proto__: Sqr,
      id: id,
      _x: x,
      _y: y,
      is_source: false,
      _rotation: 0, // [0 .. 4)
      adj: [null, null, null, null], // top right bottom left
      links: [0, 0, 0, 0], // same order.  booleans as ints.  does *not* include the current rotation
      num_sides: 4,
    };
  },

  draw_fg: function() {
    const cv = this._view = add_transformed_clone(gridview, 'gg', 'translate(' + (this._x * sqr_size + sqr_half) + ',' + (this._y * sqr_size + sqr_half) + ')');
    const inner = cv.firstChild, ls = this.links;
    if(ls[0]) add_transformed_clone(inner, 'sqr-line', '');
    if(ls[1]) add_transformed_clone(inner, 'sqr-line', 'rotate(90)');
    if(ls[2]) add_transformed_clone(inner, 'sqr-line', 'rotate(180)');
    if(ls[3]) add_transformed_clone(inner, 'sqr-line', 'rotate(270)');
    if(this.is_source) add_transformed_clone(inner, 'sqr-core', '');
    else if(sum(ls) === 1) add_transformed_clone(inner, 'sqr-node', '');
    gridview.appendChild(cv);
    this.redraw(); // to handle the initial random rotation
  },

  redraw: function(x, y) {
    this._view.firstChild.setAttribute('transform', 'rotate(' + (this._rotation * 90) + ')');
  },

  show_powered: function(is_powered) {
    this._view.className.baseVal = is_powered ? 'powered' : '';
  },
};


create_grid_functions.hex = function(width, height, wrap) {
  if(wrap) {
    if(height % 2) ++height;
    if(width % 2) ++width;
  }

  const cell_grid = new Array(width);
  var id = 0;
  for(var x = 0; x != width; ++x) {
    cell_grid[x] = new Array(height);
    for(var y = 0; y != height; ++y) cell_grid[x][y] = Hex.make(id++, x, y);
  }
  for(var x = 0; x != width; ++x) {
    for(var y = 0; y != height; ++y) {
      var cell = cell_grid[x][y];
      connect_to(cell_grid, cell, 1, x, y - 1);
      var slope_up_y = x % 2 ? y - 1 : y;
      connect_to(cell_grid, cell, 0, x - 1, slope_up_y);
      connect_to(cell_grid, cell, 2, x + 1, slope_up_y);
    }
  }
  if(wrap) {
    for(var x = 0; x != width; ++x) connect_to(cell_grid, cell_grid[x][0], 1, x, height - 1);
    for(var y = 0; y != height; ++y) {
      connect_to(cell_grid, cell_grid[0][y], 0, width - 1, y);
      connect_to(cell_grid, cell_grid[0][y], 5, width - 1, y + 1);
    }
    connect_to(cell_grid, cell_grid[0][height - 1], 5, width - 1, 0);
  }

  const source = cell_grid[Math.floor(width / 2)][Math.floor(height / 2)];
  source.is_source = true;

  return {
    view_width: width * hex_hoffset + hex_overhang,
    view_height: height * hex_height + hex_half_height,
    cells: Array.concat.apply(null, cell_grid),
    source_cell: source,
    bg_component: HexBackground,
    walls_component: HexWalls,
  };
};

const Hex = {
  // even column are the ones offset downward at the top of the grid
  make: function(id, x, y) {
    return {
      __proto__: Hex,
      id: id,
      _x: x,
      _y: y,
      is_source: false,
      _rotation: 0, // [0 .. 6)
      // upleft up upright downright down downleft
      adj: [null, null, null, null, null, null],
      links: [0, 0, 0, 0, 0, 0],
      num_sides: 6,
    };
  },

  _center_translate: function() {
    if(this.__center_translate) return this.__center_translate;
    const x = this._x * hex_hoffset + hex_half_width;
    const y = this._y * hex_height + hex_half_height + (this._x % 2 ? 0 : hex_half_height);
    return this.__center_translate = 'translate(' + x + ',' + y + ')';
  },

  draw_fg: function() {
    const cv = this._view = add_transformed_clone(gridview, 'gg', this._center_translate());
    const inner = cv.firstChild, ls = this.links;
    if(ls[0]) add_transformed_clone(inner, 'hex-spoke', 'rotate(-60)');
    if(ls[1]) add_transformed_clone(inner, 'hex-spoke', '');
    if(ls[2]) add_transformed_clone(inner, 'hex-spoke', 'rotate(60)');
    if(ls[3]) add_transformed_clone(inner, 'hex-spoke', 'rotate(120)');
    if(ls[4]) add_transformed_clone(inner, 'hex-spoke', 'rotate(180)');
    if(ls[5]) add_transformed_clone(inner, 'hex-spoke', 'rotate(240)');
    if(this.is_source) add_transformed_clone(inner, 'hex-tile', 'scale(0.5)').className.baseVal = 'core';
    else if(sum(ls) === 1) add_transformed_clone(inner, 'hex-node', '');
    gridview.appendChild(cv);
    this.redraw(); // to handle the initial random rotation
  },

  redraw: function(x, y) {
    this._view.firstChild.setAttribute('transform', 'rotate(' + (this._rotation * 60) + ')');
  },

  show_powered: function(is_powered) {
    this._view.className.baseVal = is_powered ? 'powered' : '';
  },
};
