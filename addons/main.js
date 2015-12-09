// This contains skrollr stylesheets (https://github.com/Prinzhorn/skrollr-stylesheets) converted to an Ember mixin

import Ember from 'ember';

export default Ember.Mixin.create({

  content: null,

  contents: Ember.A(),

  //Finds the declaration of an animation block.
  rxAnimation: /@-skrollr-keyframes\s+([\w-]+)/g,

  //Finds the block of keyframes inside an animation block.
  //http://regexpal.com/ saves your ass with stuff like this.
  rxKeyframes: /\s*\{\s*((?:[^{]+\{[^}]*\}\s*)+?)\s*\}/g,

  //Gets a single keyframe and the properties inside.
  rxSingleKeyframe: /([\w\-]+)\s*\{([^}]+)\}/g,

  //Optional keyframe name prefix to work around SASS (>3.4) issues
  keyframeNameOptionalPrefix: 'skrollr-',

  //Finds usages of the animation.
  rxAnimationUsage: /-skrollr-animation-name\s*:\s*([\w-]+)/g,

  //Finds usages of attribute setters.
  rxAttributeSetter: /-skrollr-(anchor-target|smooth-scrolling|emit-events|menu-offset)\s*:\s*['"]([^'"]+)['"]/g,

  fetchRemote: function(url) {
    let xhr = new XMLHttpRequest();

    /*
     * Yes, these are SYNCHRONOUS requests.
     * Simply because skrollr stylesheets should run while the page is loaded.
     * Get over it.
     */
    try {
      xhr.open('GET', url, false);
      xhr.send(null);
    } catch (e) {
      //Fallback to XDomainRequest if available
      if (window.XDomainRequest) {
        xhr = new XDomainRequest();
        xhr.open('GET', url, false);
        xhr.send(null);
      }
    }

    return xhr.responseText;
  },

  //"main"
  kickstart: function(stylesheets) {
    //Iterate over all stylesheets, embedded and remote.
    let stylesheetIndex = 0;
    let contents = this.get('contents');

    for(stylesheetIndex; stylesheetIndex < stylesheets.length; ++stylesheetIndex) {
      const sheet = stylesheets[stylesheetIndex];

      if(sheet.tagName === 'LINK') {
        if(sheet.getAttribute('data-skrollr-stylesheet') === null) {
          continue;
        }

        //Test media attribute if matchMedia available.
        if(window.matchMedia) {
          const media = sheet.getAttribute('media');

          if(media && !matchMedia(media).matches) {
            continue;
          }
        }

        //Remote stylesheet, fetch it (synchrnonous).
        this.set('content', this.fetchRemote(sheet.href));
      } else {
        //Embedded stylesheet, grab the node content.
        this.set('content', sheet.textContent || sheet.innerText || sheet.innerHTML);
      }

      const content = this.get('content');

      if (content) {
        contents.pushObject(content);
      }
    }

    //We take the stylesheets in reverse order.
    //This is needed to ensure correct order of stylesheets and inline styles.
    contents.reverse();

    let animations = {};
    let selectors = [];
    let attributes = [];
    let contentIndex = 0;

    let currentContent = null;

    //Now parse all stylesheets.
    for (contentIndex; contentIndex < contents.length; ++contentIndex) {
      currentContent = contents.objectAt(contentIndex);

      this.parseAnimationDeclarations(currentContent, animations);
      this.parseAnimationUsage(currentContent, selectors);
      this.parseAttributeSetters(currentContent, attributes);
    }

    this.applyKeyframeAttributes(animations, selectors);
    this.applyAttributeSetters(attributes);
  },

  //Finds animation declarations and puts them into the output map.
  parseAnimationDeclarations: function(input, output) {
    let rxAnimation = this.get('rxAnimation');
    let rxKeyframes = this.get('rxKeyframes');
    let rxSingleKeyframe = this.get('rxSingleKeyframe');
    let animation;
    let rawKeyframes;
    let keyframe;
    let curAnimation;

    rxAnimation.lastIndex = 0;

    while((animation = rxAnimation.exec(input)) !== null) {
      //Grab the keyframes inside this animation.
      rxKeyframes.lastIndex = rxAnimation.lastIndex;
      rawKeyframes = rxKeyframes.exec(input);

      //Grab the single keyframes with their CSS properties.
      rxSingleKeyframe.lastIndex = 0;

      //Save the animation in an object using it's name as key.
      curAnimation = output[animation[1]] = {};

      while((keyframe = rxSingleKeyframe.exec(rawKeyframes[1])) !== null) {
        //Put all keyframes inside the animation using the keyframe (like botttom-top, or 100) as key
        //and the properties as value (just the raw string, newline stripped).
        curAnimation[keyframe[1]] = keyframe[2].replace(/[\n\r\t]/g, '');
      }
    }
  },

  //Extracts the selector of the given block by walking backwards to the start of the block.
  extractSelector: function(input, startIndex) {
    let begin;
    let end = startIndex;

    //First find the curly bracket that opens this block.
    while(end-- && input.charAt(end) !== '{') {}

    //The end is now fixed to the right of the selector.
    //Now start there to find the begin of the selector.
    begin = end;

    //Now walk farther backwards until we grabbed the whole selector.
    //This either ends at beginning of string or at end of next block.
    while(begin-- && input.charAt(begin - 1) !== '}') {}

    //Return the cleaned selector.
    return input.substring(begin, end).replace(/[\n\r\t]/g, '');
  },

  //Finds usage of animations and puts the selectors into the output array.
  parseAnimationUsage: function(input, output) {
    let match;
    let selector;
    let rxAnimationUsage = this.get('rxAnimationUsage');

    rxAnimationUsage.lastIndex = 0;

    while((match = rxAnimationUsage.exec(input)) !== null) {
      //Extract the selector of the block we found the animation in.
      selector = this.extractSelector(input, rxAnimationUsage.lastIndex);

      //Associate this selector with the animation name.
      output.push([selector, match[1]]);
    }
  },

  //Finds usage of attribute setters and puts the selector and attribute data into the output array.
  parseAttributeSetters: function(input, output) {
    let match;
    let selector;
    let rxAttributeSetter = this.get('rxAttributeSetter');

    rxAttributeSetter.lastIndex = 0;

    while((match = rxAttributeSetter.exec(input)) !== null) {
      //Extract the selector of the block we found the animation in.
      selector = this.extractSelector(input, rxAttributeSetter.lastIndex);

      //Associate this selector with the attribute name and value.
      output.push([selector, match[1], match[2]]);
    }
  },

  //Applies the keyframes (as data-attributes) to the elements.
  applyKeyframeAttributes: function(animations, selectors) {
    let elements;
    let keyframes;
    let keyframeName;
    let cleanKeyframeName;
    let elementIndex;
    let attributeName;
    let attributeValue;
    let curElement;
    let selectorIndex = 0;
    const keyframeNameOptionalPrefix = this.get('keyframeNameOptionalPrefix');

    for(selectorIndex; selectorIndex < selectors.length; selectorIndex++) {
      elements = document.querySelectorAll(selectors[selectorIndex][0]);

      if(!elements) {
        continue;
      }

      keyframes = animations[selectors[selectorIndex][1]];

      for(keyframeName in keyframes) {
        if(keyframeName.indexOf(keyframeNameOptionalPrefix) === 0) {
          cleanKeyframeName = keyframeName.substring(keyframeNameOptionalPrefix.length);
        } else {
          cleanKeyframeName = keyframeName;
        }

        for(elementIndex = 0; elementIndex < elements.length; elementIndex++) {
          curElement = elements[elementIndex];
          attributeName = 'data-' + cleanKeyframeName;
          attributeValue = keyframes[keyframeName];

          //If the element already has this keyframe inline, give the inline one precedence by putting it on the right side.
          //The inline one may actually be the result of the keyframes from another stylesheet.
          //Since we reversed the order of the stylesheets, everything comes together correctly here.
          if(curElement.hasAttribute(attributeName)) {
            attributeValue += curElement.getAttribute(attributeName);
          }

          curElement.setAttribute(attributeName, attributeValue);
        }
      }
    }
  },

  //Applies the keyframes (as data-attributes) to the elements.
  applyAttributeSetters: function(selectors) {
    var curSelector;
    var elements;
    var attributeName;
    var attributeValue;
    var elementIndex;

    for(var selectorIndex = 0; selectorIndex < selectors.length; selectorIndex++) {
      curSelector = selectors[selectorIndex];
      elements = document.querySelectorAll(curSelector[0]);
      attributeName = 'data-' + curSelector[1];
      attributeValue = curSelector[2];

      if(!elements) {
        continue;
      }

      for(elementIndex = 0; elementIndex < elements.length; elementIndex++) {
        elements[elementIndex].setAttribute(attributeName, attributeValue);
      }
    }
  },

  initStyleSheets: function() {
    this.kickstart(document.querySelectorAll('link, style'));
  }
});
