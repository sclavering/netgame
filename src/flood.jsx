const Flood = {
    new_state(grid, settings) {
        return new Array(grid.tiles.length).fill(0).map(_ => random_int(settings.num_colours));
    },

    update_for_tile_click(grid, tile_state, clicked_tile) {
        const mutable_tile_state = tile_state.slice();
        return this._update_colours_mut(grid, mutable_tile_state, tile_state[clicked_tile.id]) ? mutable_tile_state : null;
    },

    _update_colours_mut(grid, mutable_tile_state, selected_colour) {
        const start_colour = mutable_tile_state[0];
        if(start_colour === selected_colour) return false;
        function _visit(tile) {
            if(!tile || mutable_tile_state[tile.id] !== start_colour) return;
            mutable_tile_state[tile.id] = selected_colour;
            tile.adj.map(_visit);
        };
        _visit(grid.tiles[0]);
        return true;
    },

    _is_solved(grid, tile_state) {
        const colour = tile_state[0];
        return tile_state.every(x => x === colour);
    },

    solve_state: function(grid, num_colours, tile_state) {
        const recursion_limit = 3;

        const _choose_move = (tile_state, depth) => {
            let best = { chosen_colour: -1, max_distance: tile_state.length + 1, num_at_max_distance: 0, num_at_zero_distance: 0 };
            for(let candidate_colour = 0; candidate_colour !== num_colours; ++candidate_colour) {
                if(tile_state[0] === candidate_colour) continue;
                let tmp_tile_state = tile_state.slice();
                this._update_colours_mut(grid, tmp_tile_state, candidate_colour);
                if(this._is_solved(grid, tmp_tile_state)) return { chosen_colour: candidate_colour, max_distance: -1, num_at_max_distance: depth, num_at_zero_distance: grid.length };
                let tmp = depth < recursion_limit - 1 ? _choose_move(tmp_tile_state, depth + 1) : _search(tmp_tile_state);
                if(_is_move_better_than(tmp, best)) {
                    best = tmp;
                    // Recursive calls to _choose_move() will have left it as the *next* chosen move, which our caller doesn't care about - only what *we* chose.  And calls to _search() just return -1 as a placeholder.
                    best.chosen_colour = candidate_colour;
                }
            }
            return best;
        };

        // This is a heuristic used to guess which grid states probably require fewest moves to solve.
        const _is_move_better_than = (candidate, target) => {
            if(candidate.max_distance < target.max_distance) return true;
            if(candidate.max_distance !== target.max_distance) return false;
            if(candidate.num_at_max_distance < target.num_at_max_distance) return true;
            if(candidate.num_at_max_distance !== target.num_at_max_distance) return false;
            return candidate.num_at_zero_distance > target.num_at_zero_distance;
        }

        const _search = tile_state => {
            // "Distance" means the number of different colour changes between the root an the target tile.
            let current_distance = 0;
            const search_queue = tile_state.slice();
            const search_distances = tile_state.slice();
            search_distances.fill(-1);
            search_distances[0] = 0;
            // invariant: queue[start .. end) are tiles where distance[tile.id] is equal to current_distance
            search_queue.fill(null);
            search_queue[0] = grid.tiles[0];
            let start = 0;
            let end = 1;
            let num_at_zero_distance = 0;
            let num_at_max_distance = 0;
            while(end < search_queue.length) {
                let ix = start;
                while(ix < end) {
                    let tile = search_queue[ix++];
                    let colour = tile_state[tile.id];
                    for(let other of tile.adj) if(other && search_distances[other.id] === -1 && tile_state[other.id] === colour) {
                        search_distances[other.id] = current_distance;
                        search_queue[end++] = other;
                    }
                }
                let end_current_distance = end;
                if(!num_at_zero_distance) num_at_zero_distance = end; // Correct because it's only set on the first loop through.
                ++current_distance;
                ix = start;
                while(ix < end_current_distance) {
                    let tile = search_queue[ix++];
                    for(let other of tile.adj) if(other && search_distances[other.id] === -1) {
                        // We could assert tile's colour is different from other's colour, if we had assert()
                        search_distances[other.id] = current_distance;
                        search_queue[end++] = other;
                    }
                }
                start = end_current_distance;
                num_at_max_distance = end - end_current_distance; // Correct because it's overwritten until the final loop.
            }
            return { chosen_colour: -1, max_distance: current_distance, num_at_max_distance: num_at_max_distance, num_at_zero_distance: num_at_zero_distance };
        };

        const chosen_colours = [];
        let tmp_tile_state = tile_state.slice();
        while(!this._is_solved(grid, tmp_tile_state)) {
            let move = _choose_move(tmp_tile_state, 0);
            let chosen_colour = move.chosen_colour;
            this._update_colours_mut(grid, tmp_tile_state, chosen_colour);
            chosen_colours.push(chosen_colour);
        }
        return chosen_colours;
    },
};
