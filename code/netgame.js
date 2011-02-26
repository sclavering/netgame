var svg = null;
var gridview = null;
const svg_templates = {};

window.onload = function() {
  svg = document.getElementById('gameview');
  for each(var el in svg.getElementsByTagName('defs')[0].childNodes) {
    if(!el.id) continue;
    svg_templates[el.id] = el;
    el.removeAttribute('id'); // because we clone them
  }
  gridview = document.getElementById('sqrgrid');
  new_grid('hex', 9, 9, true, 0.9);
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
    while(gridview.hasChildNodes()) gridview.removeChild(gridview.lastChild);
    const vb = svg.viewBox.baseVal;
    vb.width = grid.view_width;
    vb.height = grid.view_height;
    // Draw each group of things separately for z-ordering
    for each(var c in grid.cells) c.draw_bg();
    for each(var c in grid.cells) c.draw_fg();
    for each(var c in grid.cells) c.draw_walls();
    this.update_poweredness();
    const self = this;
    gridview.onclick = function(ev) { self._onclick(ev) };
  },

  update_poweredness: function() {
    const powered_id_set = which_cells_are_powered(this._grid);
    for each(var c in this._grid.cells) c.show_powered(c.id in powered_id_set);
  },

  _onclick: function(ev) {
    const g = ev.target;
    if(!g.__cell) return;
    const cell = g.__cell;
    cell.rotate_clockwise();
    cell.redraw();
    this.update_poweredness();
  },
};


function new_grid(shape, width, height, wrap, wall_probability) {
  const grid = create_grid_functions[shape](width, height, wrap);
  fill_grid(grid);
  // Walls are just hints, added after grid filling to make it easier to solve.
  if(wall_probability) for each(var c in grid.cells) c.add_walls(wall_probability);
  const max_rotation = grid.cells[0].adj.length;
  for each(var c in grid.cells) c._rotation = random_int(max_rotation);
  view.show(grid);
}


function fill_grid(grid) {
  const source = grid.source_cell;
  const linked = {};
  linked[source.id] = true;

  const fringe = [];
  const fringe_set = {};
  for each(var fr in source.adj) {
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
    cell.adj[random_dir].links[cell.invert_direction(random_dir)] = 1;
    linked[cell.id] = true;

    for each(var adj in cell.adj) {
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
      if(!adj || !cell.had_current_bidirectional_link(dir)) continue;
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


const create_grid_functions = {
  sqr: function(width, height, wrap) {
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
    };
  },

  hex: function(width, height, wrap) {
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
    };
  },
};


function connect_to(cell_grid, cell, dir, x, y) {
  const other = (cell_grid[x] && cell_grid[x][y]) || null;
  if(!other) return;
  cell.adj[dir] = other;
  other.adj[cell.invert_direction(dir)] = cell;
}


const Sqr = {
  make: function(id, x, y) {
    return {
      __proto__: Sqr,
      id: id,
      _x: x,
      _y: y,
      adj: [null, null, null, null], // top right bottom left
      links: [0, 0, 0, 0], // same order.  booleans as ints.  does *not* include the current rotation
    };
  },

  is_source: false,

  _rotation: 0, // [0 .. 4)

  add_walls: function(wall_probability) {
    const links = this.links, adj = this.adj;
    if(!links[0] && adj[0] && Math.random() < wall_probability) adj[0].adj[2] = null, adj[0] = null;
    if(!links[3] && adj[3] && Math.random() < wall_probability) adj[3].adj[1] = null, adj[3] = null;
  },

  invert_direction: function(dir) {
    return [2, 3, 0, 1][dir];
  },

  had_current_bidirectional_link: function(dir) {
    return this.has_current_link_to(dir) && this.adj[dir].has_current_link_to(Sqr.invert_direction(dir));
  },

  has_current_link_to: function(dir) {
    dir -= this._rotation;
    if(dir < 0) dir += 4;
    return !!this.links[dir];
  },

  rotate_clockwise: function() {
    this._rotation = [1, 2, 3, 0][this._rotation];
  },

  draw_bg: function() {
    var tv = add_transformed_clone(gridview, 'sqr-tile', 'translate(' + (this._x * sqr_size) + ', ' + (this._y * sqr_size) + ')');
    tv.__cell = this;
  },

  draw_fg: function() {
    const cv = this._view = add_transformed_clone(gridview, 'gg', 'translate(' + (this._x * sqr_size + sqr_half) + ',' + (this._y * sqr_size + sqr_half) + ')');
    const inner = cv.firstChild, ls = this.links;
    if(ls[0]) add_transformed_clone(inner, 'sqr-line', '');
    if(ls[1]) add_transformed_clone(inner, 'sqr-line', 'rotate(90)');
    if(ls[2]) add_transformed_clone(inner, 'sqr-line', 'rotate(180)');
    if(ls[3]) add_transformed_clone(inner, 'sqr-line', 'rotate(270)');
    if(sum(ls) === 1) add_transformed_clone(inner, 'sqr-node', '');
    if(this.is_source) add_transformed_clone(inner, 'sqr-core', '');
    gridview.appendChild(cv);
    this.redraw(); // to handle the initial random rotation
  },

  redraw: function(x, y) {
    this._view.firstChild.setAttribute('transform', 'rotate(' + (this._rotation * 90) + ')');
  },

  show_powered: function(is_powered) {
    this._view.className.baseVal = is_powered ? 'powered' : '';
  },

  draw_walls: function() {
    const x = this._x, y = this._y, adj = this.adj;
    if(!x && !adj[3]) this._draw_wall('sqr-wall-v', x, y);
    if(!adj[1]) this._draw_wall('sqr-wall-v', x + 1, y);
    if(!y && !adj[0]) this._draw_wall('sqr-wall-h', x, y);
    if(!adj[2]) this._draw_wall('sqr-wall-h', x, y + 1);
  },

  _draw_wall: function(wall, x, y) {
    add_transformed_clone(gridview, wall, 'translate(' + (x * sqr_size) + ', ' + (y * sqr_size) + ')');
  },
};


const Hex = {
  // even column are the ones offset downward at the top of the grid
  make: function(id, x, y) {
    return {
      __proto__: Hex,
      id: id,
      _x: x,
      _y: y,
      // upleft up upright downright down downleft
      adj: [null, null, null, null, null, null],
      links: [0, 0, 0, 0, 0, 0],
    };
  },

  is_source: false,

  _rotation: 0, // [0 .. 6)

  add_walls: function(wall_probability) {
    const links = this.links, adj = this.adj;
    if(!links[0] && adj[0] && Math.random() < wall_probability) adj[0].adj[3] = null, adj[0] = null;
    if(!links[1] && adj[1] && Math.random() < wall_probability) adj[1].adj[4] = null, adj[1] = null;
    if(!links[2] && adj[2] && Math.random() < wall_probability) adj[2].adj[5] = null, adj[2] = null;
  },

  invert_direction: function(dir) {
    return [3, 4, 5, 0, 1, 2][dir];
  },

  had_current_bidirectional_link: function(dir) {
    return this.has_current_link_to(dir) && this.adj[dir].has_current_link_to(Hex.invert_direction(dir));
  },

  has_current_link_to: function(dir) {
    return !!this.links[(dir + 6 - this._rotation) % 6];
  },

  rotate_clockwise: function() {
    this._rotation = (this._rotation + 1) % 6;
//     this._rotation = [1, 2, 3, 4, 5, 0][this._rotation];
  },

  draw_bg: function() {
    var tv = add_transformed_clone(gridview, 'hex-tile', this._center_translate());
    tv.__cell = this;
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
    if(sum(ls) === 1) add_transformed_clone(inner, 'hex-node', '');
    if(this.is_source) {
      var core = add_transformed_clone(inner, 'hex-tile', 'scale(0.5)');
      core.className.baseVal = 'core';
    }
    gridview.appendChild(cv);
    this.redraw(); // to handle the initial random rotation
  },

  redraw: function(x, y) {
    this._view.firstChild.setAttribute('transform', 'rotate(' + (this._rotation * 60) + ')');
  },

  show_powered: function(is_powered) {
    this._view.className.baseVal = is_powered ? 'powered' : '';
  },

  draw_walls: function() {
    // Avoiding drawing walls already drawn by another tile is rather complicated, so don't bother worrying
    const x = this._x, y = this._y, adj = this.adj;
    if(!adj[0]) this._draw_wall(0);
    if(!adj[1]) this._draw_wall(60);
    if(!adj[2]) this._draw_wall(120);
    if(!adj[3]) this._draw_wall(180);
    if(!adj[4]) this._draw_wall(240);
    if(!adj[5]) this._draw_wall(300);
  },

  _draw_wall: function(angle) {
    add_transformed_clone(gridview, 'hex-wall', this._center_translate() + ' rotate(' + angle + ')');
  },
};
