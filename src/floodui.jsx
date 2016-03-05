const grid_padding = 20;

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

const tile_colour = "#cccccc";

const flood_colours = [
    "red",
    "blue",
    "yellow",
    "green",
    "orange",
    "purple",    
];


window.onload = _ => {
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";
    document.body.style.margin = 0;
    document.body.style.padding = 0;
    document.body.style.overflow = "hidden";
    const wrapper = document.createElement("div");
    document.body.appendChild(wrapper);
    ReactDOM.render(React.createElement(FloodUI), wrapper);
};


const FloodUI = React.createClass({
    getInitialState() {
        const settings = {
            shape: "hex",
            width: 15,
            height: 15,
            num_colours: 5,
        };
        const grid = GridUtil.generate(settings);
        return {
            showing_settings: false,
            settings: settings,
            grid: grid,
            initial_grid_state: Flood.new_state(grid, settings),
        };
    },
    render() {
        const on_show_settings = _ => this.setState({ showing_settings: true });
        const on_settings_save = new_settings => this.setState({ showing_settings: false, settings: new_settings, grid: new_grid(new_settings) });
        const on_settings_cancel = _ => this.setState({ showing_settings: false });
        const on_new_game = _ => this.setState(s => ({ initial_grid_state: Flood.new_state(s.grid, s.settings) }));
        return <div style={{ fontFamily: "sans-serif" }}>
            <FloodGameUI grid={ this.state.grid } initial_grid_state={ this.state.initial_grid_state } num_colours={ this.state.settings.num_colours } on_new_game={ on_new_game } on_show_settings={ on_show_settings }/>
            { this.state.showing_settings ? <SettingsUI settings={ this.state.settings } on_settings_save={ on_settings_save } on_settings_cancel={ on_settings_cancel }/> : null }
        </div>;
    },
});


function SettingsUI(props) {
    return <div/>;
};


const FloodGameUI = React.createClass({
    getInitialState() {
        return this._initial_state(this.props);
    },
    componentWillReceiveProps(next_props) {
        if(next_props.grid !== this.props.grid || next_props.initial_grid_state !== this.props.initial_grid_state) this.setState(this._initial_state(next_props));
    },
    _initial_state(props) {
        const t0 = Date.now();
        const solution = Flood.solve_state(props.grid, props.num_colours, props.initial_grid_state);
        console.log("solution", Date.now() - t0, solution.map(x => flood_colours[x]));
        return {
            grid_state_history: [props.initial_grid_state],
            grid_state_ix: 0,
            num_moves_originally_required: solution.length,
        };
    },
    render() {
        const grid = this.props.grid;
        const params = grid.shape === "sqr" ? {
                view_width: grid.width * sqr_size + 2 * grid_padding,
                view_height: grid.height * sqr_size + 2 * grid_padding,
                component: FloodSquareTile,
            } : {
                view_width: grid.width * hex_hoffset + hex_overhang + 2 * grid_padding,
                view_height: grid.height * hex_height + hex_half_height + 2 * grid_padding,
                component: FloodHexTile,
            };
        const on_tile_click = tile => this.setState(s => {
            const new_grid_state = Flood.update_for_tile_click(grid, s.grid_state_history[s.grid_state_ix], tile);
            if(!new_grid_state) return null;
            const grid_state_history = s.grid_state_ix < s.grid_state_history.length - 1 ? s.grid_state_history.slice(0, s.grid_state_ix + 1) : s.grid_state_history;
            return {
                grid_state_history: grid_state_history.concat([new_grid_state]),
                grid_state_ix: grid_state_history.length,
            };
        });
        const on_undo = _ => this.setState(s => {
            return s.grid_state_ix ? { grid_state_ix: s.grid_state_ix - 1 } : null;
        });
        const on_redo = _ => this.setState(s => {
            return s.grid_state_ix < s.grid_state_history.length - 1 ? { grid_state_ix: s.grid_state_ix + 1 } : null;
        });
        const grid_state = this.state.grid_state_history[this.state.grid_state_ix];
        return <div style={{ position: "absolute", width: "100%", height: "100%", background: tile_colour, boxSizing: "padding-box", paddingTop: 30, MozUserSelect: "none" }}>
            <div style={{ position: "absolute", top: 10, left: 0, width: "100%", height: 20, textAlign: "center" }}>
                <span style={{ display: "inline-block", minWidth: "15ex", verticalAlign: "middle" }}>Moves: { this.state.grid_state_ix }/{ this.state.num_moves_originally_required }</span>
                <input type="button" onClick={ on_undo } value="Undo" disabled={ !this.state.grid_state_ix } style={{ verticalAlign: "middle" }}/>
                <input type="button" onClick={ on_redo } value="Redo" disabled={ this.state.grid_state_ix >= this.state.grid_state_history.length - 1 } style={{ verticalAlign: "middle" }}/>
                <input type="button" onClick={ this.props.on_new_game } value="New Game" style={{ verticalAlign: "middle" }}/>
                <input type="button" onClick={ this.props.on_show_settings } value="Settings" style={{ verticalAlign: "middle" }}/>
            </div>
            <svg viewBox={ "0 0 " + params.view_width + " " + params.view_height } preserveAspectRatio="xMidYMid meet" width="100%" height="100%">
                { grid.tiles.map(tile => <PureWrapper component={ params.component } key={ tile.id } tile={ tile } colour={ grid_state[tile.id] } onclick={ ev => on_tile_click(tile) }/>) }
            </svg>
        </div>;        
    },
});


function FloodSquareTile(props) {
    const transform = "translate(" + (props.tile.x * sqr_size + sqr_half) + "," + (props.tile.y * sqr_size + sqr_half) + ")";
    return <g transform={ transform } style={ props.style } onClick={ props.onclick }>
        <rect x={ -sqr_half } y={ -sqr_half } width={ sqr_size } height={ sqr_size } style={{ fill: flood_colours[props.colour] }}/>
        { props.children }
    </g>;
};

function FloodHexTile(props) {
    const transform = hex_center_translate(props.tile);
    return <g transform={ transform } style={ props.style } onClick={ props.onclick }>
        <path d={ hex_path } style={ props.bg_style } style={{ fill: flood_colours[props.colour] }}/>
        { props.children }
    </g>;
};

function hex_center_translate(tile) {
    const x = tile.x * hex_hoffset + hex_half_width;
    const y = tile.y * hex_height + hex_half_height + (tile.x % 2 ? 0 : hex_half_height);
    return "translate(" + x + "," + y + ")";
};


const PureWrapper = React.createClass({
    shouldComponentUpdate(next_props, _next_state) {
        // This assumes the prop names aren't changing, but that's almost certainly correct.
        for(let k in next_props) if(this.props[k] !== next_props[k]) return true;
        return false;
    },
    render() {
        return React.createElement(this.props.component, this.props);
    },
});
