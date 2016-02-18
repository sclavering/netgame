// babel --no-comments -w gridui.jsx --out-file gridui.js ui.jsx --out-file ui.js 


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
            width: 19,
            height: 9,
            wrap: true,
            wall_probability: 0.6,
        };
        return {
            settings: settings,
            grid: new_grid(settings),
        };
    },
    render: function() {
        const on_new_game = _ => this.setState(s => ({ grid: new_grid(s.settings) }));
        return <div style={{ fontFamily: "sans-serif" }}>
            <GameUI grid={ this.state.grid } on_new_game={ on_new_game }/>
        </div>;
    },
});
