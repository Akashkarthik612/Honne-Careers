-- Beta usage limits (PLAN-2): starting a new AI chat (or a Try it message) is its own
-- daily action. The limits themselves live in backend/config/limits.yaml, not here.
alter table app.usage_events drop constraint usage_events_action_check;
alter table app.usage_events add constraint usage_events_action_check
  check (action in ('full_tailor', 'bullet_tailor', 'pdf', 'analysis', 'upload',
                    'chat_message', 'chat_start'));
