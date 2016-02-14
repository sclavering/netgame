// babel -w --no-comments ui.jsx --out-file ui.js


function GameBackground(props) {
    const BackgroundComponent = props.grid.bg_component;
    return <g>{ props.grid.cells.map((c, ix) => <BackgroundComponent key={ ix } tile={ c } onClick={ ev => props.oncellclick(c) }/>) }</g>;
};

function GameWalls(props) {
    const WallsComponent = props.grid.walls_component;
    return <g>{ props.grid.cells.map((c, ix) => <WallsComponent key={ ix } tile={ c }/>) }</g>;
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


function HexBackground(props) {
    return <path className="tile" d="M -74,0 L -37,-65 37,-65 74,0 37,65 -37,65 z" transform={ props.tile._center_translate() } onClick={ props.onClick }/>;
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
    return <line id="hex-wall" className="wall" x1="-74" x2="-37" y2="-65" transform={ props.tile._center_translate() + " rotate(" + props.rotate + ")" }/>;
};
