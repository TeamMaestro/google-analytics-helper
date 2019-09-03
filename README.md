[![NPM version](https://img.shields.io/npm/v/@teamhive/google-analytics-helper.svg)](https://npmjs.org/package/@teamhive/google-analytics-helper) [![NPM downloads](https://img.shields.io/npm/dm/@teamhive/google-analytics-helper.svg)](https://npmjs.org/package/@teamhive/google-analytics-helper)

# Google Analytics Helper

This Google Analytics Helper is an easy way to add Google Analytics with offline tracking support to any single-page app.

### Installation
```
npm install @teamhive/google-analytics-helper
```

### Usage
Somewhere in the app bootstrap process:
```typescript
import { initalizeGoogleAnalytics } from '@teamhive/google-analytics-helper';

initalizeGoogleAnalytics('UA-XXXXX-Y');
```

That's all you need to get Google Analytics running! The `analytics.js` snippet will automatically be injected and any failed events will be stored and synced with Google Analytics once the connection resumes.

Note that this is only a global implementation of Google Analytics to support tracking events offline and automatically syncing them once the app is online again. You still need to track pageviews and events somehow, either manually like this:
```typescript
ga('send', 'pageview', 'myHomePage');
```
Or by using a 3rd party library that supports Google Analytics like [Angulartics](https://github.com/angulartics/angulartics2).

### Offline Tracking Limitation
Any tracking events that occur when Google's Analytics API is unreachable (most often when the user has no network connection) will be cached in the browser's LocalStorage until they can be synced with Google Analytics. Because of Google's limitation with backdating analytics events more than 4 hours in the past, any events that are synced less than 4 hours from when they occured will be tracked at the real time they occured. Any event that occured more than 4 hours in the past will be tracked as if it occured 4 hours from the moment the sync occurs.
