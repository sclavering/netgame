const sqr_size = 130;
const sqr_half = 65;
const sqr_source_half_size = 32;
const sqr_node_radius = 30;

const hex_height = 130;
const hex_half_height = 65;
const hex_half_width = 74;
const hex_hoffset = 111; // width of left point and rectangular body together
const hex_overhang = 37; // width of right point
const hex_node_radius = 30;
const hex_path = `M -${hex_half_width},0 L -${hex_overhang},-${hex_half_height} ${hex_overhang},-${hex_half_height} ${hex_half_width},0 ${hex_overhang},${hex_half_height} -${hex_overhang},${hex_half_height} z`;

const tile_outline_colour = "white";
const tile_colour = "#cccccc";
const locked_tile_colour = "#909090";
const wall_colour = "red";
const node_colour = "pink";
const line_powered_colour = "green";
const line_colour = "black";

const wall_width = 7;
const line_width = 7;
const tile_outline_width = 3;


const GameUI = React.createClass({
    getInitialState: function() {
        return this._initial_state(this.props.grid);
    },
    componentWillReceiveProps: function(next_props) {
        if(next_props.grid !== this.props.grid) this.setState(this._initial_state(next_props.grid));
    },
    _initial_state(grid) {
        return {
            grid_state: Grid.initial_state_randomising_orientations(grid),
            prev_tile: null,
            prev_tile_rotation_count: 0,
            move_count: 0,
        };
    },
    render: function() {
        const grid = this.props.grid;
        const on_tile_click = (ev, tile) => {
            // Note: this must be outside the callback, because React clears the properties of its fake Event object.
            const should_lock = ev.shiftKey || ev.button === 2;
            if(!should_lock && tile.num_distinct_rotations === 1) return;
            this.setState(s => {
                if(should_lock) return { grid_state: Grid.lock_or_unlock_tile(grid, s.grid_state, tile) };
                if(s.grid_state.locked_set[tile.id]) return null;
                const rv = {
                    grid_state: Grid.rotate_tile_clockwise(grid, s.grid_state, tile),
                    prev_tile: tile,
                    prev_tile_rotation_count: 1,
                    move_count: s.move_count + 1,
                };
                if(tile === s.prev_tile) {
                    rv.prev_tile_rotation_count = (s.prev_tile_rotation_count + 1) % tile.num_distinct_rotations;
                    // If we're continuing rotation of a tile, don't increase the count.
                    if(rv.prev_tile_rotation_count > 1) --rv.move_count;
                    // If a tile has is back to its starting position (or a visually-equivalent position, for rotationally-symmetrical tiles), undo the original move-count increase for turning it.  Because sometimes you click a tile by accident (e.g. when meaning to click an adjacent one), and it's annoying to suffer a penalty for that.
                    else if(!rv.prev_tile_rotation_count) rv.move_count -= 2;
                }
                return rv;
            });
        };
        const params = grid.shape === "sqr" ? {
                view_width: grid.width * sqr_size,
                view_height: grid.height * sqr_size,
                bg_component: SquareBackground,
                tile_component: SquareTile,
                walls_component: SquareWalls,
            } : {
                view_width: grid.width * hex_hoffset + hex_overhang,
                view_height: grid.height * hex_height + hex_half_height,
                bg_component: HexBackground,
                tile_component: HexTile,
                walls_component: HexWalls,
            };
        return <div style={{ position: "absolute", width: "100%", height: "100%", background: tile_colour, boxSizing: "padding-box", padding: "40px 10px 10px", MozUserSelect: "none" }}>
            <div style={{ position: "absolute", top: 10, left: 0, width: "100%", height: 20, textAlign: "center" }}>
                <span style={{ display: "inline-block", minWidth: "15ex", verticalAlign: "middle" }}>Moves: { this.state.move_count }</span>
                <input type="button" onClick={ this.props.on_new_game } value="New Game" style={{ verticalAlign: "middle" }}/>
                <input type="button" onClick={ this.props.on_show_settings } value="Settings" style={{ verticalAlign: "middle" }}/>
            </div>
            <svg viewBox={ "0 0 " + params.view_width + " " + params.view_height } preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
                <GameBackground component={ params.bg_component } grid={ grid } on_tile_click={ on_tile_click } locked_set={ this.state.grid_state.locked_set }/>
                <GameTiles component={ params.tile_component } grid={ grid } grid_state={ this.state.grid_state }/>
                <PureWrapper component={ GameWalls } walls_component={ params.walls_component } grid={ grid }/>
            </svg>
        </div>;
    },
});

function GameBackground(props) {
    return <g>{ props.grid.tiles.map((tile, ix) => <PureWrapper component={ props.component } key={ ix } is_locked={ tile.id in props.locked_set } tile={ tile } onClick={ ev => props.on_tile_click(ev, tile) }/>) }</g>;
};

function GameTiles(props) {
    return <g>{ props.grid.tiles.map((tile, ix) => <PureWrapper component={ props.component } key={ ix } tile={ tile } orientation={ props.grid_state.orientations[tile.id] } is_powered={ !!props.grid_state.powered_set[tile.id] }/>) }</g>;
};

function GameWalls(props) {
    const WallsComponent = props.walls_component;
    return <g>{ props.grid.tiles.map((tile, ix) => <WallsComponent key={ ix } tile={ tile }/>) }</g>;
};


const PureWrapper = React.createClass({
    shouldComponentUpdate: function(next_props, _next_state) {
        // This assumes the prop names aren't changing, but that's almost certainly correct.
        for(let k in next_props) if(this.props[k] !== next_props[k]) return true;
        return false;
    },
    render() {
        return React.createElement(this.props.component, this.props);
    },
});


function SquareBackground(props) {
    return <rect width={ sqr_size } height={ sqr_size } x={ props.tile.x * sqr_size } y={ props.tile.y * sqr_size } onClick={ props.onClick } style={{ stroke: tile_outline_colour, strokeWidth: tile_outline_width, fill: props.is_locked ? locked_tile_colour : tile_colour }}/>;
};

function SquareWalls(props) {
    const x = props.tile.x, y = props.tile.y, adj = props.tile.adj;
    return <g>
        { !x && !adj[3] ? <SquareWall x1={ x } x2={ x } y1={ y } y2={ y + 1 }/> : null }
        { !adj[1] ? <SquareWall x1={ x + 1 } x2={ x + 1 } y1={ y } y2={ y + 1 }/> : null }
        { !y && !adj[0] ? <SquareWall x1={ x } x2={ x + 1} y1={ y } y2={ y }/> : null }
        { !adj[2] ? <SquareWall x1={ x } x2={ x + 1} y1={ y + 1 } y2={ y + 1 }/> : null }
    </g>;
};

function SquareWall(props) {
    const x = props.x * sqr_size;
    return <line x1={ props.x1 * sqr_size } x2={ props.x2 * sqr_size } y1={ props.y1 * sqr_size } y2={ props.y2 * sqr_size } style={{ stroke: wall_colour, strokeWidth: wall_width, strokeLinecap: "round" }}/>;
};

function SquareTile(props) {
        const { tile, orientation, is_powered } = props;
        // Note: .style.stroke is inherited by the descendant line segments.
        return <g transform={ "translate(" + (tile.x * sqr_size + sqr_half) + "," + (tile.y * sqr_size + sqr_half) + ")" } style={{ stroke: is_powered ? line_powered_colour : line_colour }}>
            <g transform={ "rotate(" + (orientation * 90) + ")" }>
                <PureWrapper component={ SquareTileInner } tile={ tile }/>
            </g>
        </g>;
};

function SquareTileInner(props) {
    const tile = props.tile;
    return <g style={{ pointerEvents: "none" }}>
        <g style={{ strokeWidth: line_width, strokeLinecap: "round", fill: "none" }}>
            { tile.links[0] ? <line y2={ -sqr_half } transform={ "rotate(0)" }/> : null }
            { tile.links[1] ? <line y2={ -sqr_half } transform={ "rotate(90)" }/> : null }
            { tile.links[2] ? <line y2={ -sqr_half } transform={ "rotate(180)" }/> : null }
            { tile.links[3] ? <line y2={ -sqr_half } transform={ "rotate(270)" }/> : null }
        </g>
        { tile.is_source ? <rect x={ -sqr_source_half_size } y={ -sqr_source_half_size } width={ 2 * sqr_source_half_size } height={ 2 * sqr_source_half_size } stroke={ line_colour }/> : null }
        { !tile.is_source && tile.is_leaf_node ? <circle r={ sqr_node_radius } stoke={ line_colour } fill={ node_colour }/> : null }
    </g>;
};


function HexBackground(props) {
    return <path d={ hex_path } transform={ hex_center_translate(props.tile) } onClick={ props.onClick } style={{ stroke: tile_outline_colour, strokeWidth: tile_outline_width, fill: props.is_locked ? locked_tile_colour : tile_colour }}/>;
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
    return <line x1={ -hex_half_width } x2={ -hex_overhang } y2={ -hex_half_height } transform={ hex_center_translate(props.tile) + " rotate(" + props.rotate + ")" } style={{ stroke: wall_colour, strokeWidth: wall_width, strokeLinecap: "round" }}/>;
};

function HexTile(props) {
        const { tile, orientation, is_powered } = props;
        // Note: .style.stroke is inherited by the descendant line segments.
        return <g transform={ hex_center_translate(tile) } style={{ stroke: is_powered ? line_powered_colour : line_colour }}>
            <g transform={ "rotate(" + (orientation * 60) + ")" }>
                <PureWrapper component={ HexTileInner } tile={ tile }/>
            </g>
        </g>;
};

function HexTileInner(props) {
    const tile = props.tile;
    return <g style={{ pointerEvents: "none" }}>
        <g style={{ strokeWidth: line_width, strokeLinecap: "round", fill: "none" }}>
            { tile.links[0] ? <line y2={ -hex_half_height } transform={ "rotate(-60)" }/> : null }
            { tile.links[1] ? <line y2={ -hex_half_height } transform={ "rotate(0)" }/> : null }
            { tile.links[2] ? <line y2={ -hex_half_height } transform={ "rotate(60)" }/> : null }
            { tile.links[3] ? <line y2={ -hex_half_height } transform={ "rotate(120)" }/> : null }
            { tile.links[4] ? <line y2={ -hex_half_height } transform={ "rotate(180)" }/> : null }
            { tile.links[5] ? <line y2={ -hex_half_height } transform={ "rotate(240)" }/> : null }
        </g>
        { tile.is_source ? <path d={ hex_path } transform="scale(0.5)" stroke={ line_colour }/> : null }
        { !tile.is_source && tile.is_leaf_node ? <circle r={ hex_node_radius } stoke={ line_colour } fill={ node_colour }/> : null }
    </g>;
};

function hex_center_translate(tile) {
    const x = tile.x * hex_hoffset + hex_half_width;
    const y = tile.y * hex_height + hex_half_height + (tile.x % 2 ? 0 : hex_half_height);
    return "translate(" + x + "," + y + ")";
};
