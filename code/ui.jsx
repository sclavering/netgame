// babel -w --no-comments ui.jsx --out-file ui.js


function GameBackground(props) {
    const BackgroundComponent = props.grid.bg_component;
    return <g>{ props.grid.cells.map((c, ix) => <BackgroundComponent key={ ix } tile={ c } onClick={ ev => props.oncellclick(c) }/>) }</g>;
};


function SquareBackground(props) {
    return <rect className="tile" width="50" height="50" x={ props.tile._x * sqr_size } y={ props.tile._y * sqr_size } onClick={ props.onClick }/>;
};


function HexBackground(props) {
    return <path className="tile" d="M -74,0 L -37,-65 37,-65 74,0 37,65 -37,65 z" transform={ props.tile._center_translate() } onClick={ props.onClick }/>;
};
