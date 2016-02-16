// babel -w --no-comments ui.jsx --out-file ui.js


const sqr_size = 50;
const sqr_half = 25;

const hex_height = 130;
const hex_half_height = 65;
const hex_half_width = 74;
const hex_hoffset = 111; // width of left point and rectangular body together
const hex_overhang = 37; // width of right point


function show_game(grid) {
  const wraper = document.getElementById("wrapper");
  ReactDOM.unmountComponentAtNode(wrapper);
  ReactDOM.render(React.createElement(GameUI, { grid: grid }), wrapper);
};


const GameUI = React.createClass({
    getInitialState: function() {
        return {
            grid_state: Grid.initial_state_randomising_orientations(this.props.grid),
        };
    },
    render: function() {
        const grid = this.props.grid;
        const on_tile_click = tile => {
            this.setState(s => ({ grid_state: Grid.rotate_tile_clockwise(grid, s.grid_state, tile) }));
        };
        return <svg viewBox={ "0 0 " + grid.view_width + " " + grid.view_height } preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
            <GameBackground grid={ grid } on_tile_click={ on_tile_click }/>
            <GameTiles grid={ grid } grid_state={ this.state.grid_state }/>
            <GameWalls grid={ grid }/>
        </svg>;
    },
});

function GameBackground(props) {
    const BackgroundComponent = props.grid.bg_component;
    return <g>{ props.grid.tiles.map((tile, ix) => <BackgroundComponent key={ ix } tile={ tile } onClick={ ev => props.on_tile_click(tile) }/>) }</g>;
};

function GameTiles(props) {
    const TileComponent = props.grid.tile_component;
    return <g>{ props.grid.tiles.map((tile, ix) => <TileComponent key={ ix } tile={ tile } orientation={ props.grid_state.orientations[tile.id] } is_powered={ !!props.grid_state.powered_set[tile.id] }/>) }</g>;
};

function GameWalls(props) {
    const WallsComponent = props.grid.walls_component;
    return <g>{ props.grid.tiles.map((tile, ix) => <WallsComponent key={ ix } tile={ tile }/>) }</g>;
};


function SquareBackground(props) {
    return <rect className="tile" width="50" height="50" x={ props.tile._x * sqr_size } y={ props.tile._y * sqr_size } onClick={ props.onClick }/>;
};

function SquareWalls(props) {
    const x = props.tile._x, y = props.tile._y, adj = props.tile.adj;
    return <g>
        { !x && !adj[3] ? <SquareWallVertical x={ x } y={ y }/> : null }
        { !adj[1] ? <SquareWallVertical x={ x + 1 } y={ y }/> : null }
        { !y && !adj[0] ? <SquareWallHorizontal x={ x } y={ y }/> : null }
        { !adj[2] ? <SquareWallHorizontal x={ x } y={ y + 1 }/> : null }
    </g>;
};

function SquareWallVertical(props) {
    const x = props.x * sqr_size;
    return <line className="wall" x1={ x } x2={ x } y1={ props.y * sqr_size } y2={ (props.y + 1) * sqr_size }/>;
};

function SquareWallHorizontal(props) {
    const y = props.y * sqr_size;
    return <line className="wall" y1={ y } y2={ y } x1={ props.x * sqr_size } x2={ (props.x + 1) * sqr_size }/>;
};

const SquareTile = React.createClass({
    shouldComponentUpdate: function(next_props, _next_state) {
        for(let k in next_props) if(next_props[k] !== this.props[k]) return true;
        return false;
    },
    render: function() {
        const { tile, orientation, is_powered } = this.props;
        return <g transform={ "translate(" + (tile._x * sqr_size + sqr_half) + "," + (tile._y * sqr_size + sqr_half) + ")" } className={ is_powered ? "powered" : null }>
            <g transform={ "rotate(" + (orientation * 90) + ")" }>
                <SquareTileInner tile={ tile }/>;
            </g>
        </g>;
    },
});

const SquareTileInner = React.createClass({
    shouldComponentUpdate: function(next_props, _next_state) {
        return this.props.tile !== next_props.tile;
    },
    render() {
        const tile = this.props.tile;
        return <g>
            { tile.links[0] ? <SquareLine angle={ 0 }/> : null }
            { tile.links[1] ? <SquareLine angle={ 90 }/> : null }
            { tile.links[2] ? <SquareLine angle={ 180 }/> : null }
            { tile.links[3] ? <SquareLine angle={ 270 }/> : null }
            { tile.is_source ? <rect className="core" x="-20" y="-20" width="40" height="40"/> : null }
            { !tile.is_source && sum(tile.links) === 1 ? <circle className="node" r="12"/> : null }
        </g>;
    },
});

function SquareLine(props) {
    return <line className="line" y2="-25" transform={ "rotate(" + props.angle + ")" }/>;
};


function HexBackground(props) {
    return <path className="tile" d="M -74,0 L -37,-65 37,-65 74,0 37,65 -37,65 z" transform={ hex_center_translate(props.tile) } onClick={ props.onClick }/>;
};

function HexWalls(props) {
    // Avoiding drawing walls already drawn for another tile is rather complicated, so don't bother.
    const adj = props.tile.adj;
    return <g>
        { !adj[0] ? <HexWall tile={ props.tile } rotate={ 0 }/> : null }
        { !adj[1] ? <HexWall tile={ props.tile } rotate={ 60 }/> : null }
        { !adj[2] ? <HexWall tile={ props.tile } rotate={ 120 }/> : null }
        { !adj[3] ? <HexWall tile={ props.tile } rotate={ 180 }/> : null }
        { !adj[4] ? <HexWall tile={ props.tile } rotate={ 240 }/> : null }
        { !adj[5] ? <HexWall tile={ props.tile } rotate={ 300 }/> : null }
    </g>
};

function HexWall(props) {
    return <line className="wall" x1="-74" x2="-37" y2="-65" transform={ hex_center_translate(props.tile) + " rotate(" + props.rotate + ")" }/>;
};

const HexTile = React.createClass({
    shouldComponentUpdate: function(next_props, _next_state) {
        for(let k in next_props) if(next_props[k] !== this.props[k]) return true;
        return false;
    },
    render: function() {
        const { tile, orientation, is_powered } = this.props;
        return <g transform={ hex_center_translate(tile) } className={ is_powered ? "powered" : null }>
            <g transform={ "rotate(" + (orientation * 60) + ")" }>
                <HexTileInner tile={ tile }/>;
            </g>
        </g>;
    },
});

const HexTileInner = React.createClass({
    shouldComponentUpdate: function(next_props, _next_state) {
        return this.props.tile !== next_props.tile;
    },
    render() {
        const tile = this.props.tile;
        return <g>
            { tile.links[0] ? <HexLine angle={ -60 }/> : null }
            { tile.links[1] ? <HexLine angle={ 0 }/> : null }
            { tile.links[2] ? <HexLine angle={ 60 }/> : null }
            { tile.links[3] ? <HexLine angle={ 120 }/> : null }
            { tile.links[4] ? <HexLine angle={ 180 }/> : null }
            { tile.links[5] ? <HexLine angle={ 240 }/> : null }
            { tile.is_source ? <path className="core" d="M -74,0 L -37,-65 37,-65 74,0 37,65 -37,65 z" transform="scale(0.5)"/> : null }
            { !tile.is_source && sum(tile.links) === 1 ? <circle className="node" r="30"/> : null }
        </g>;
    },
});

function HexLine(props) {
    return <line className="line" y2="-65" transform={ "rotate(" + props.angle + ")" }/>;
};

function hex_center_translate(tile) {
    const x = tile._x * hex_hoffset + hex_half_width;
    const y = tile._y * hex_height + hex_half_height + (tile._x % 2 ? 0 : hex_half_height);
    return "translate(" + x + "," + y + ")";
};
