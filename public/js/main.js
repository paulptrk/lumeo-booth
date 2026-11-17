// entry point (loaded by index.html). starts each panel and wires them together:
// booking and racing refresh the bookings table. the panels don't import each other,
// apart from the race reusing the booking form's input.
//
//   api.js, session.js        talk to the server and hold the token (no dom code)
//   format.js, values.js      plain helpers (no dom code)
//   dom.js                    building elements safely
//   auth, booking, race,      one module per panel
//   bookings, log, health

import { initLog } from "./log.js";
import { initHealth } from "./health.js";
import { initAuth } from "./auth.js";
import { initBooking } from "./booking.js";
import { initRace } from "./race.js";
import { initBookings, loadBookings } from "./bookings.js";

initLog(); // first, so it records every call after it
initHealth();
initAuth();
initBookings();
initBooking({ onBooked: loadBookings });
initRace({ onDone: loadBookings });
