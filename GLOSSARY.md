# Cuebox

Cuebox is a local app for choosing a film from a Letterboxd watchlist. This is the language for the watchlist page and for the day a film was watched.

## Language

**Watchlist view**:
The default tab of the Watchlist page: films still waiting to be watched.
_Avoid_: Active view, active tab

**Watched view**:
The Watchlist page tab of films already watched or still waiting on a watch review.
_Avoid_: History, watched list

**Archived view**:
The Watchlist page tab of films removed from the watchlist without being kept as watched.
_Avoid_: Deleted, dismissed

**Date watched**:
The calendar day a film was watched. For ordering the Watched view, a film's date watched is its newest such day.
_Avoid_: Date added, logged date

**Unknown watched date**:
A Letterboxd import watch stored as 28 September 1984 because the export had no diary date. It is not a day the film was watched.
_Avoid_: Default date, null date, placeholder date

**Dateless film**:
A film with no date watched, because it has no watch record or only an unknown watched date.
_Avoid_: Undated film
