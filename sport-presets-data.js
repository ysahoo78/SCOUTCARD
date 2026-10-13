// Keep these labels and keys stable: saved profiles store metric values by key.
const field = (key, label, placeholder) => Object.freeze({ key, label, placeholder });

export const SPORT_PRESETS = Object.freeze({
  'Soccer': [
    field('goals', 'Goals', 'e.g. 12 in 2026 season'),
    field('assists', 'Assists', 'e.g. 8 in 2026 season'),
    field('clean_sheets', 'Clean sheets', 'For goalkeepers / defenders'),
    field('saves', 'Saves', 'For goalkeepers')
  ],
  'Basketball': [
    field('points_per_game', 'Points per game', 'e.g. 16.4 PPG'),
    field('rebounds_per_game', 'Rebounds per game', 'e.g. 7.2 RPG'),
    field('assists_per_game', 'Assists per game', 'e.g. 4.1 APG'),
    field('shooting', 'Shooting', 'e.g. 42% from three')
  ],
  'Football': [
    field('passing', 'Passing', 'e.g. 1,200 yards / 14 TD'),
    field('rushing', 'Rushing', 'e.g. 650 yards / 8 TD'),
    field('receiving', 'Receiving', 'e.g. 34 catches / 510 yards'),
    field('defense', 'Defense', 'e.g. 68 tackles / 4 sacks')
  ],
  'Track & Field': [
    field('events', 'Event(s) / discipline', 'e.g. 100m, 200m, long jump'),
    field('pr_100m', '100m personal best', 'e.g. 11.24 seconds'),
    field('pr_200m', '200m personal best', 'e.g. 22.80 seconds'),
    field('pr_400m', '400m personal best', 'e.g. 51.6 seconds'),
    field('other_pr', 'Other event personal best', 'e.g. long jump 6.25m')
  ],
  'Cross Country': [
    field('pr_5k', '5K personal best', 'e.g. 17:32'),
    field('pr_3mile', '3-mile personal best', 'e.g. 16:49'),
    field('pr_8k', '8K personal best', 'If applicable'),
    field('best_finish', 'Best meet finish', 'Meet, place, and year')
  ],
  'Baseball': [
    field('batting_avg', 'Batting average', 'e.g. .325 in 2026'),
    field('on_base', 'On-base percentage', 'e.g. .412'),
    field('pitching', 'Pitching', 'e.g. 2.80 ERA / 52 K'),
    field('velocity', 'Velocity', 'e.g. 82 mph fastball')
  ],
  'Softball': [
    field('batting_avg', 'Batting average', 'e.g. .325 in 2026'),
    field('on_base', 'On-base percentage', 'e.g. .412'),
    field('pitching', 'Pitching', 'e.g. 2.80 ERA / 52 K'),
    field('velocity', 'Velocity', 'e.g. 62 mph fastball')
  ],
  'Volleyball': [
    field('kills', 'Kills', 'Include matches / season'),
    field('digs', 'Digs', 'Include matches / season'),
    field('assists', 'Assists', 'Include matches / season'),
    field('blocks', 'Blocks', 'Include matches / season')
  ],
  'Lacrosse': [
    field('goals', 'Goals', 'Include games / season'),
    field('assists', 'Assists', 'Include games / season'),
    field('ground_balls', 'Ground balls', 'Include games / season'),
    field('saves', 'Saves', 'For goalkeepers')
  ],
  'Swimming & Diving': [
    field('events', 'Event(s)', 'e.g. 100 free, 200 IM'),
    field('pr_50_free', '50 freestyle personal best', 'e.g. 24.80 seconds'),
    field('pr_100_free', '100 freestyle personal best', 'e.g. 54.20 seconds'),
    field('other_pr', 'Other swim time / dive score', 'Name the event and result')
  ],
  'Tennis': [
    field('singles_record', 'Singles record', 'e.g. 12–4 in 2026'),
    field('doubles_record', 'Doubles record', 'e.g. 8–2 in 2026'),
    field('rating', 'Rating / ranking', 'Include the system and date'),
    field('best_result', 'Best tournament result', 'Event, finish, and year')
  ],
  'Golf': [
    field('scoring_avg', 'Scoring average', 'Include round count / season'),
    field('lowest_round', 'Lowest round', 'Score, course, and year'),
    field('handicap', 'Handicap index', 'Include date if available'),
    field('best_finish', 'Best tournament finish', 'Event, finish, and year')
  ],
  'Wrestling': [
    field('weight_class', 'Weight class', 'e.g. 138 lb'),
    field('record', 'Season record', 'e.g. 28–6 in 2026'),
    field('pins', 'Pins', 'Include season'),
    field('best_finish', 'Best tournament finish', 'Event, finish, and year')
  ],
  'Other sport': [
    field('key_result', 'Key result / performance', 'Describe the result and year'),
    field('record', 'Record / ranking', 'Include context and season'),
    field('measurable', 'Measurable / personal best', 'Include units and event')
  ]
});

export const SPORT_OPTIONS = Object.freeze(Object.keys(SPORT_PRESETS));

export function presetFor(sport) {
  return SPORT_PRESETS[sport] || SPORT_PRESETS['Other sport'];
}
