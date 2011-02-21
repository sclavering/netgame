const sqrSize = 20;

window.onload = function() {
  view.init();
  newGrid(9, 9);
}

const kTileSize = 20;

const view = {
  init: function() {
    const c = this._canvas = document.getElementById("netgame-view");
    this._context = c.getContext("2d");
    delete this.init
  },

  _grid: null,
  _canvas: null,  // <canvas>
  _context: null, // nsIDOMCanvasRenderingContext2D

  show: function(grid) {
    this._grid = grid;
    const canvas = this._canvas, context = this._context;
    var w, h;
    canvas.width = w = grid.width * kTileSize;
    canvas.height = h = grid.height * kTileSize;
    context.clearRect(0, 0, w, h);
    for(var x = 0; x != grid.width; ++x)
      for(var y = 0; y != grid.height; ++y)
        this.update(x, y);
  },

  update: function(x, y) {
    const context = this._context;
    const pxx = x * kTileSize, pxy = y * kTileSize;
    context.clearRect(pxx, pxy, kTileSize, kTileSize);
    
    const cell = this._grid[x][y], links = cell.links;
    const xs = [0, 10, 0, -10]; // (x,y) offset from tile center for each link's line
    const ys = [-10, 0, 10, 0];
    const cx = pxx + 10, cy = pxy + 10; // central pixels of tile
    context.beginPath();
    dump("cell "+x+" "+y+" has links: "+links+"\n");
    for(var i = 0; i != 4; ++i) {
      if(!links[i]) continue;
      context.moveTo(cx, cy);
      context.lineTo(cx + xs[i], cy + ys[i])
    }
    context.closePath();
    context.stroke();
  }
}

function onClick(e) {
  e.target.clicked(e);
}




function newGrid(width, height) {
  const grid = createGrid(width, height);
  view.show(grid);
}


function createGrid(width, height) {
  const grid = createEmptyGrid(width, height, false, true, 12);
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
    for(var y = 0; y != height; ++y) grid[x][y] = new Cell(x, y, x*width+y);
  }

  for(x = 0; x != width; ++x) {
    for(y = 0; y != width; ++y) {
      var cell = grid[x][y];
      if(x != 0) cell.left = grid[x-1][y];
      else if(xWrap) cell.left = grid[xmax][y];
      if(x != xmax) cell.right = grid[x+1][y];
      else if(xWrap) cell.right = grid[0][y];
      if(y != 0) cell.up = grid[x][y-1];
      else if(yWrap) cell.up = grid[x][ymax];
      if(y != ymax) cell.down = grid[x][y+1];
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
  source.isLinked = true;
  source.powered = true;

  var fringe0 = source.adj;
  var fringe = [];
  var uniq = new Array(width*height); // ensures uniqueness of elements of |fringe|
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
  this.id = id; // x*width + height, basically
  this.x = x;
  this.y = y;
  // is this cell linked to the power source yet?
  this.isLinked = false;

  // up, right, down, left
  this.adj = [null, null, null, null];
  // 1 or 0, as bools, indicating if this block is linked up, right, down, left
  this.links = [0, 0, 0, 0];
}
Cell.prototype = {
  powered: false,

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
    //dump("cell ("+this.x+","+this.y+"), has "+linked.length+" linked adjs\n");

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
    for(var i = 0; i != 3; ++i) links[i] = links[i+1];
    links[3] = tmp;
  },

  rotateRight: function() {
    const links = this.links, tmp = links[3];
    for(var i = 2; i >= 0; --i) links[i+1] = links[i];
    links[0] = tmp;
  }
}
