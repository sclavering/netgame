window.onload = function() {
  view.init();
  newGrid(9, 9);
}

const kTileSize = 50;

const view = {
  init: function() {
    const ids = {
      _svg: 'gameview',
      _gridview: 'sqrgrid',
      _template_core: 'sqr-core',
      _template_none: 'sqr-none',
      _template_t: 'sqr-t',
      _template_tr: 'sqr-tr',
      _template_tb: 'sqr-tb',
      _template_trb: 'sqr-trb',
      _template_trbl: 'sqr-trbl',
    };
    for(var [k, v] in Iterator(ids)) this[k] = document.getElementById(v);
    delete this.init;
  },

  _grid: null,
  _svg: null,
  _gridview: null,
  _views: null,

  show: function(grid) {
    this._grid = grid;
    const gv = this._gridview;
    while(gv.hasChildNodes()) gv.removeChild(gv.lastChild);
    const vb = this._svg.viewBox.baseVal;
    vb.width = grid.width * 50;
    vb.height = grid.height * 50;
    const tvs = this._tileviews = new Array(grid.width);
    for(var x = 0; x != grid.width; ++x) {
      tvs[x] = new Array(grid.height);
      for(var y = 0; y != grid.height; ++y) {
        tvs[x][y] = this._make_tile(x, y);
      }
    }
    gv.onclick = this._onclick;
  },

  _make_tile: function(x, y) {
    const cell = this._grid[x][y];
    const [shape, base_angle] = this._calculate_shape(cell);
    const view = this['_template_' + shape].cloneNode(true);
    view.__x = x;
    view.__y = y;
    view.removeAttribute('id');
    const view_x = x * 50 + 25, view_y = y * 50 + 25;
    view.setAttribute('transform', 'translate(' + view_x + ',' + view_y + ') rotate(' + base_angle + ')');
    if(cell.isSource) {
      const core = this._template_core.cloneNode(true);
      core.removeAttribute('id');
      view.firstChild.appendChild(core);
    }
    this._gridview.appendChild(view);
    return view;
  },

  _calculate_shape: function(tile) {
    const links = tile.links;
    const links_sum = links[3] * 8 + links[2] * 4 + links[1] * 2 + links[0];
    return ({
        0: ['none', 0],
        1: ['t', 0],
        2: ['t', 90],
        3: ['tr', 0],
        4: ['t', 180],
        5: ['tb', 0],
        6: ['tr', 90],
        7: ['trb', 0],
        8: ['t', 270],
        9: ['tr', 270],
        10: ['tb', 90],
        11: ['trb', 270],
        12: ['tr', 180],
        13: ['trb', 180],
        14: ['trb', 90],
        15: ['trbl', 0],
      })[links_sum];
  },

  _onclick: function(ev) {
    const g = ev.target.parentNode.parentNode, x = g.__x, y = g.__y;
  },
}


function newGrid(width, height) {
  const grid = createGrid(width, height);
  view.show(grid);
}


function createGrid(width, height) {
  const grid = createEmptyGrid(width, height, false, false, 12);
  fillGrid(grid);
  return grid;
}

// xWrap, yWrap are bools, all others are integers
function createEmptyGrid(width, height, xWrap, yWrap, walls) {
  const grid = new Array(width);
  grid.width = width;
  grid.height = height;

  const xmax = width -1 ;
  const ymax = height - 1;

  for(var x = 0; x != width; ++x) {
    grid[x] = new Array(height);
    for(var y = 0; y != height; ++y) grid[x][y] = new Cell(x, y, x * width + y);
  }

  for(x = 0; x != width; ++x) {
    for(y = 0; y != width; ++y) {
      var cell = grid[x][y];
      if(x != 0) cell.left = grid[x - 1][y];
      else if(xWrap) cell.left = grid[xmax][y];
      if(x != xmax) cell.right = grid[x + 1][y];
      else if(xWrap) cell.right = grid[0][y];
      if(y != 0) cell.up = grid[x][y - 1];
      else if(yWrap) cell.up = grid[x][ymax];
      if(y != ymax) cell.down = grid[x][y + 1];
      else if(yWrap) cell.down = grid[x][0];
    }
  }

  // Add some "walls" (extra barriers between cells which should be adjacent)
  for(var i = 0; i != walls; ++i) {
    do { x = Math.random(); } while(x == 1.0);
    do { y = Math.random(); } while(y == 1.0);
    do { var adj = Math.random(); } while(adj == 1.0);
    x = Math.floor(x * width);
    y = Math.floor(y * height);
    adj = Math.floor(adj * 4);

    cell = grid[x][y];
    var adjcell = grid[x][y].adj[adj];
    if(adjcell) {
      adjcell.adj[(adj + 2) % 4] = null;
      cell.adj[adj] = null;
    } else {
      --i;
    }
  }

  return grid;
}


function fillGrid(grid) {
  const width = grid.length, height = grid[0].length;

  var source = grid[Math.floor(width/2)][Math.floor(height/2)];
  source.isSource = true;
  source.isLinked = true;

  var fringe0 = source.adj;
  var fringe = [];
  var uniq = new Array(width * height); // ensures uniqueness of elements of |fringe|
  for(var i = 0; i != 4; ++i) {
    var fr = fringe0[i];
    if(!fringe0[i]) continue;
    fringe.push(fr);
    uniq[fr.id] = true;
  }

  for(var num = fringe.length; num; num = fringe.length) {
    // pick a random cell from the fringe
    do { var ran = Math.random(); } while(ran == 1.0);
    var cell = fringe.splice(Math.floor(ran * num), 1)[0];

    // link it into the network, and add its unlinked adjs to the fringe
    cell.linkToRandomAdj();

    var adjs = cell.adj;
    for(i = 0; i != 4; ++i) {
      var adj = adjs[i];
      if(!adj || adj.isLinked || uniq[adj.id]) continue;
      fringe.push(adj);
      uniq[adj.id] = true;
    }
  }

  return grid;
}




function Cell(x, y, id) {
  this.id = id; // x * width + height, basically
  this.x = x;
  this.y = y;

  // up, right, down, left
  this.adj = [null, null, null, null];
  // 1 or 0, as bools, indicating if this block is linked up, right, down, left
  this.links = [0, 0, 0, 0];
}
Cell.prototype = {
  isSource: false,
  isLinked: false, // is this cell linked to the power source yet?

  get up() { return this.adj[0]; },
  set up(val) { return this.adj[0] = val; },
  get down() { return this.adj[2]; },
  set down(val) { return this.adj[2] = val; },
  get right() { return this.adj[1]; },
  set right(val) { return this.adj[1] = val; },
  get left() { return this.adj[3]; },
  set left(val) { return this.adj[3] = val; },

  // link this cell to a random adjacent unlinked cell
  linkToRandomAdj: function() {
    const adjs = this.adj;

    var linked = [];
    for(var i = 0; i != 4; ++i) {
      var adj = adjs[i];
      if(adj && adj.isLinked) linked.push(i);
    }

    do { var ran = Math.random(); } while(ran == 1.0);
    ran = Math.floor(ran * linked.length);
    ran = linked[ran]; // so it's a cell's index

    this.links[ran] = 1;
    this.isLinked = true;

    var i2 = (ran + 2) % 4;
    adj = adjs[ran];
    adj.links[i2] = 1;
  },

  // left == anticlockwise, if that's not obvious
  rotateLeft: function() {
    const links = this.links, tmp = links[0];
    for(var i = 0; i != 3; ++i) links[i] = links[i + 1];
    links[3] = tmp;
  },

  rotateRight: function() {
    const links = this.links, tmp = links[3];
    for(var i = 2; i >= 0; --i) links[i + 1] = links[i];
    links[0] = tmp;
  }
}
