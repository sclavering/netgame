const background_colour = "#cccccc";
const overlay_background_colour = "rgba(204, 204, 204, 0.7)";


window.onload = function() {
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";
    document.body.style.margin = 0;
    document.body.style.padding = 0;
    const wrapper = document.body.firstChild;
    ReactDOM.unmountComponentAtNode(wrapper);
    ReactDOM.render(React.createElement(MainUI), wrapper);
};


const MainUI = React.createClass({
    getInitialState: function() {
        const settings = {
            shape: "sqr",
            width: 18,
            height: 8,
            wrap: true,
            wall_probability: 0.6,
        };
        return {
            showing_settings: false,
            settings: settings,
            grid: new_grid(settings),
        };
    },
    render: function() {
        const on_show_settings = _ => this.setState({ showing_settings: true });
        const on_settings_save = new_settings => this.setState({ showing_settings: false, settings: new_settings, grid: new_grid(new_settings) });
        const on_settings_cancel = _ => this.setState({ showing_settings: false });
        const on_new_game = _ => this.setState(s => ({ grid: new_grid(s.settings) }));
        return <div style={{ fontFamily: "sans-serif" }}>
            <GameUI grid={ this.state.grid } on_new_game={ on_new_game } on_show_settings={ on_show_settings }/>
            { this.state.showing_settings ? <SettingsUI settings={ this.state.settings } on_settings_save={ on_settings_save } on_settings_cancel={ on_settings_cancel }/> : null }
        </div>;
    },
});


function SettingsUI(props) {
    const on_submit = ev => {
        ev.preventDefault();
        const form = ev.target;
        const settings = {
            shape: form.elements["shape"].value,
            width: +form.elements["width"].value,
            height: +form.elements["height"].value,
            wall_probability: +form.elements["wall_probability"].value,
            wrap: form.elements["wrap"].checked,
        };
        props.on_settings_save(settings);
    };
    const settings = props.settings;
    const radios = (name, nums) => nums.map(n => <label key={ n }><input type="radio" name={ name } value={ n } defaultChecked={ n === settings[name] }/>{ n } </label>);
    const th_style = { textAlign: "right", fontWeight: "normal", padding: "0 5px 10px 0" };
    const td_style = { verticalAlign: "top" };
    return <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: overlay_background_colour }}>
        <form onSubmit={ on_submit } style={{ width: 500, margin: "100px auto 0", padding: "2em", background: background_colour, border: "1px solid white" }}>
            <table><tbody>
                <tr><th style={ th_style }>Tiles:</th><td style={ td_style }>
                    <label><input type="radio" name="shape" value="sqr" defaultChecked={ settings.shape === "sqr" }/> Square</label>
                    <label><input type="radio" name="shape" value="hex" defaultChecked={ settings.shape === "hex" }/> Hexagonal</label>
                </td></tr>
                <tr><th style={ th_style }>Width:</th><td style={ td_style }>
                    { radios("width", [4, 6, 8, 10, 12, 14, 16, 18, 20]) }
                </td></tr>
                <tr><th style={ th_style }>Height:</th><td style={ td_style }>
                    { radios("height", [4, 6, 8, 10, 12, 14, 16, 18, 20]) }
                </td></tr>
                <tr><th style={ th_style }>Walls (hints):</th><td style={ td_style }>
                    0% <input type="range" name="wall_probability" min="0" max="1" step="0.01" defaultValue={ settings.wall_probability } style={{ verticalAlign: "middle" }}/> 100%
                </td></tr>
                <tr>
                    <th style={ th_style }><input id="wrap" type="checkbox" name="wrap" defaultChecked={ settings.wrap }/></th>
                    <td style={ td_style }><label htmlFor="wrap">Wrap around</label></td>
                </tr>
            </tbody></table>
            <p style={{ textAlign: "center", marginBottom: 0 }}><input type="button" value="Cancel" onClick={ props.on_settings_cancel }/> <input type="submit" value="Save"/></p>
        </form>
    </div>;
};
