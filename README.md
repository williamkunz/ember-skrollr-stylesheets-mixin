# ember-skrollr-stylesheets-mixin

Ember Mixin for the [skrollr-stylesheets](https://github.com/Prinzhorn/skrollr-stylesheets) plugin


## Usage
```npm install ember-skrollr-stylesheets-mixin --save```


```javascript
import Ember from 'ember';
import skrollrStyleSheets from 'ember-skrollr-stylesheets-mixin';

/* global skrollr */

/* This is assuming skrollr.js is in your vendor.js build */

export default Ember.Component.extend(skrollrStyleSheets, {

	startSkrollr: Ember.on('didRender', function() {
		// exec stylesheet imports
		this.initStyleSheets();

		// init skrollr
		skrollr.init();
	});

});
```
