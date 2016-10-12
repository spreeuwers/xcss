/*global console,fetch*/
(function xcss() {

    "use strict";
    var MAX_NESTING_LEVEL = 100;

    var allCSSRules = {};
    var visitedRules = {};
    var evtBindings = {};
    var classBindings = {};
    var contentBindings = {};
    var pullBindings = {};

    var stateListeners = [];
    var WHEN = 'when';
    var AND = 'and';
    var EXTENDS = 'extends';
    var APPLIES = 'applies';
    var EVENTS = [];
    var LOGICAL = 'LOGICAL';

    var KEYWORD_FUNCTIONS = {
        EXTENDS: extendRule,
        APPLIES: applyRule,
        COMPONENT: componentRule,
        WHEN: stateRule,
        PULL: alignRule,
        AND: LogicKeyword,
        OR: LogicKeyword
    };

    //fetch all possible events
    for (var evtKey in HTMLElement.prototype) {
        if (evtKey.indexOf('on') === 0) {
            EVENTS.push(evtKey.toUpperCase());
            //console.log(evtKey);
        }
    }
    //make keyword split expression
    var keyWordsRegExp = Object.keys(KEYWORD_FUNCTIONS).concat(EVENTS).join('|');
    var KEYWORDS = new RegExp('\\s+(' + keyWordsRegExp + '),?\\s+', 'i');
    var EVENTEXPR = new RegExp('\\W+(' + EVENTS.join('|') + ')\\W*=\\W*[\'\"]', 'i');
    var SCRIPTEXPR = /<script[>\W]/i;
    var styleSheet = addNewStylesheet();
    var components = {};

    document.addEventListener('DOMContentLoaded', processCSSRulesAsync);
    //document.addEventListener('onload', processCSSRules);
    window.addEventListener('hashchange', stateChanged);
    window.addEventListener('resize', pullBoundElements);


    return;

    ////////////////////////////////////////////////////////////////
    //
    ////////////////////////////////////////////////////////////////

    function stateChanged() {
        var state = location.hash.replace(/^#\/?/, '').split('/').map(
            function (state) {
                var parts = state.split('?');//pseudo querystring
                var parms = (parts[1] || '').split('&');
                var path = parts[0];
                var result = {};
                result[path] = {};
                parms.forEach(function (parm) {
                    var keyVal = parm.split('=');
                    var key = keyVal[0];
                    var val = keyVal[1];
                    result[path][key] = val;

                });
                return result;
            }
        );
        //collect path
        state.path = state.map(function (s) {
            return Object.keys(s)[0];
        }).join('/');
        //collect all parameter key/values in the state object
        state.params = {};
        state.forEach(
            function (s) {
                var parms = s[Object.keys(s)[0]];
                Object.keys(parms).forEach(
                    function (k) {
                        state.params[k] = parms[k];
                    }
                );
            }
        );

        console.log('state:', state);
        //invoke all stateChangeListeners
        stateListeners.forEach(
            function (listener) {
                listener(state);
            }
        );
        //rebin all events after state change
        window.setTimeout(
            function () {
                //bindAllEvents();
                //bindAllClasses();
                //bindAllContent();
                pullBoundElements();
            }, 100
        );

    }

    function bindAllContent(parent, level) {

        if (level && level > MAX_NESTING_LEVEL){
            console.log('Max nesting level is: '+ MAX_NESTING_LEVEL);
            return;
        }
        level++;
        Object.keys(contentBindings).forEach(
            function (selector) {
                insertContent(contentBindings, selector,null, null, null, parent, level);
            }
        );
    }

    function bindAllEvents(parent) {
        Object.keys(evtBindings).forEach(
            function bind(target) {
                //console.log('binding message events: ' + msg + ' to ' +  targets);
                var scope = parent || document;
                var elms = scope.querySelectorAll(target);
                for (var i = 0; i < elms.length; i++) {
                    //elms[i].addEventListener(event, makeEventListener(key));
                    var handler = evtBindings[target];
                    if (!elms[i].xcssHandler) {
                        console.log('binding message events: ' + handler.hash + ' to ' + target);
                        if (handler.hash === 'prevent'){
                            elms[i].xcssHandler = function(evt){evt.preventDefault();evt.stopPropagation();}
                        } else {
                            elms[i].xcssHandler = makeEventListener(handler.hash);
                        }
                        elms[i].addEventListener(handler.event, elms[i].xcssHandler);
                    }


                }
            }
        );
    }

    function bindAllClasses(parent) {
        Object.keys(classBindings).forEach(
            function (target) {
                var scope = parent || document;
                var targetElms = scope.querySelectorAll(target) || [];
                var sources = classBindings[target] || [];
                [].slice.call(targetElms).forEach(
                    function (elm) {
                        sources.forEach(
                            function (className) {
                                console.log('applying ' + className + ' to ' + target);
                                elm.classList.add(className);

                            }
                        );
                    }
                );
            }
        );

    }


    function processCSSRulesAsync(){
        //wait 100 ms before collecting the stylesheetrules
        //so they can be loaded bu the browser
        window.setTimeout(processCSSRules,100);
    }
    /**
     *
     */
    function processCSSRules() {
        //collect all style rules
        console.time('processCSSRules');
        collectRules(document);
        compileRules(allCSSRules);
        console.timeEnd('processCSSRules');
        stateChanged();
    }

    /**
     *
     * @param cssRules
     */
    function compileRules(cssRules) {
        Object.keys(cssRules).forEach(
            function (selector) {
                var keyword = '', target = '', sources = [], invalidKeyword, ucKeyword, lcKeyword;
                var parts = selector.split(KEYWORDS);

                if (visitedRules[selector]) {
                    //console.log('skipping visited selector: ' + selector);
                    return;
                }
                visitedRules[selector] = cssRules[selector];

                console.log('parts: [' + parts.join(' : '), '] selector:', selector);

                //initially the rule is valid
                invalidKeyword = '';

                if (parts.length > 2) {
                    //read first three fields
                    target = parts.shift().trim();
                    keyword = parts.shift().trim();
                    ucKeyword = keyword.toUpperCase();
                    lcKeyword = keyword.toLowerCase();
                    sources = parts.filter(
                        function (part) {
                            var keywordType = KEYWORD_FUNCTIONS[part.toUpperCase()];
                            invalidKeyword = (keywordType && LogicKeyword !== keywordType) ? keyword : invalidKeyword;
                            return !keywordType;
                        }
                    );

                    if (invalidKeyword) {
                        console.error('cannot proces invalid xcss rule: "' + selector + '" unexpected keyword "' + invalidKeyword + '"');
                        return;
                    }


                    if (KEYWORD_FUNCTIONS[ucKeyword]) {
                        //apply the right function for a keyword
                        KEYWORD_FUNCTIONS[ucKeyword](cssRules, selector, target, sources, keyword);
                    }

                    else if (EVENTS.indexOf(ucKeyword) >= 0) {
                        eventRule(cssRules, selector, target, sources, lcKeyword);

                    }
                } else if (cssRules[selector].style.content) {
                    insertContent(cssRules, selector, target, sources, keyword);
                }

            }
        );
    }

    //insertContent for any css role having a content property without before/after pseudo selector
    function insertContent(cssRules, selector, target, sources, keyword, parent, level) {
        var url, matches;
        var content = cssRules[selector].style.content || '';

        var targetElms = document.querySelectorAll(selector);
        if (parent){
            targetElms = parent.querySelectorAll(selector);
        }
        //only handle rules without :before/:after
        if (!/:(before|after)/.test(selector)) {
            if (!contentBindings[selector]) {
                contentBindings[selector] = {style: {content: allCSSRules[selector].style.content}};

            }

            console.log('inserting content for: ' + selector);

            if (matches = content.match(/^"url\('?([^)]*)'?\)"$/)) {
                url = matches[1];
            }

            if (matches = content.match(/^'url\("?([^)]*)"?\)'$/)) {
                url = matches[1];
            }

            if (matches = content.match(/^url\(['"]?([^)^'^"]*)['"]?\)$/)) {
                url = matches[1];
                //correct for chrome if not between quotes the style is invalid
                if (cssRules[selector].style) {
                    allCSSRules[selector].style.content = '';
                }

            }

            //for each element matching the rule insertContent
            [].slice.call(targetElms).forEach(
                function (elm) {
                    if (elm.insertedContent !== cssRules[selector].style.content) {
                        elm.insertedContent = cssRules[selector].style.content;
                        if (url) {
                            if (url.indexOf('@') === 0){
                                url = elm.getAttribute(url.substring(1));

                            }
                            loadContent(url, elm, level);
                        } else {
                            var html = eval(cssRules[selector].style.content);
                            setHtmlContent(elm, html, level)
                        }
                    }
                }
            );


        }
    }

    function pullElements(target, direction) {
        var targetElms = document.querySelectorAll(target);
        [].slice.call(targetElms).forEach(
            function (elm) {
                console.log('pulling ' + target + ' to ' + direction);
                elm.style.boxSizing = 'border-box';
                var lm = parseInt(elm.style.marginLeft || '0');
                var pullRight = elm.parentNode.offsetWidth + elm.parentNode.offsetLeft - (elm.offsetLeft + elm.offsetWidth);
                console.log('l  ' + elm.offsetLeft);
                console.log('w  ' + elm.offsetWidth);
                console.log('pw  ' + elm.offsetParent.offsetWidth);
                console.log('lm  ' + lm);
                console.log('pl  ' + pullRight);
                elm.style.marginLeft = (lm + pullRight) + 'px';
                elm.style.marginRight = '0px';
                elm.style.marginTop = '-70px';

            }
        );
    }

    function alignRule(cssRules, selector, target, sources, keyword) {
        pullBindings[target] = sources;
        pullElements(target, sources[0]);
        pullBoundElements();

    }

    function pullBoundElements() {
        Object.keys(pullBindings).forEach(
            function (target) {
                window.setTimeout(
                    function () {
                        pullElements(target, pullBindings[target]);
                    }, 100
                );
            }
        )
    }


    function componentRule(cssRules, selector, target, sources, keyword) {
        //make multiple registrations possible
        var registered = {};
        var key;
        var proto = Object.create(HTMLElement.prototype);

        var comp = {};
        var tplExpr = /\[template(Id|Url)="([\w-\/\.]*)"\]/i;
        var template = sources[0].match(tplExpr);
        //extract url of id
        if (template) {
            comp.template = {};
            template.shift();
            key = template.shift().toLowerCase();
            comp.template[key] = template.shift();
        } else {
            comp.content = cssRules[selector].style.content.replace(/^"/, '').replace(/"$/, '');
        }


        components[target.toUpperCase()] = comp;
        //default templateid = name of tag
        proto.createdCallback = function () {
            // Adding a Shadow DOM
            var root = this.createShadowRoot();
            var comp = components[this.tagName];
            // Adding a template
            if (comp.template) {
                if (comp.template.id) {
                    var tpl = document.querySelector('#' + comp.template.id);
                    var clone = document.importNode(tpl.content, true);
                    root.appendChild(clone);
                } else if (comp.template.url) {
                    fetch(comp.template.url).then(
                        function (response) {
                            return response.text();
                        }
                    ).then(
                        function (html) {
                            root.innerHTML = html;
                        }
                    )

                }

            } else {
                root.innerHTML = comp.content;
            }
        }
        document.registerElement(target, {
            prototype: proto
        });
        var self = cssRules[selector];
        styleSheet.insertRule(target + '{' + self.style.cssText + '}', styleSheet.cssRules.length);

    }

    /**
     */
    function extendRule(cssRules, selector, target, sources, keyword) {

        var newCssText = sources.map(
            function (fromSelector) {
                //resolve fromSelector when not found in currenttly resolved rules
                if (!cssRules[fromSelector]) {
                    console.log('resolving rule fromSelector: ' + fromSelector);
                    compileRules(cssRules);
                }
                if (!cssRules[fromSelector]) {
                    console.error('Could not resolve rule fromSelector: ' + fromSelector);
                } else {
                    console.debug('Resolved rule fromSelector: ' + fromSelector + ' = ' + cssRules[fromSelector].style.cssText);
                }
                return (cssRules[fromSelector]) ? cssRules[fromSelector].style.cssText : '';
            }
        ).join(' ');

        var self = cssRules[selector];
        console.log('adding rule: ' + target + '{' + newCssText + self.style.cssText + '}');
        var idx = styleSheet.insertRule(target + '{' + newCssText +  self.style.cssText + '}', styleSheet.cssRules.length);
        cssRules[target] = styleSheet.cssRules[idx];
        //load content is defined
        if (cssRules[target].style.content){
            var level = 0;
            insertContent(cssRules, target,  target, sources, keyword, document, level)
        }
    }

    /**
     * adds found classes after keyword APPLIES to the elements for the selector
     * @param cssRules
     * @param selector
     * @param target
     * @param sources
     * @param keyword
     */
    function applyRule(cssRules, selector, target, sources, keyword) {

        var targetElms = document.querySelectorAll(target);
        classBindings[target] = sources;
        [].slice.call(targetElms).forEach(
            function (elm) {
                sources.forEach(
                    function (src) {
                        var m;

                        if (m = src.match(/^\[(.*)\]$/) ) {
                            var attr = m[1].split('=');
                            console.log('applying attr: ' + m[1] + ' to ' + target);
                            elm.setAttribute(attr[0],attr[1]||attr[0]);
                        }  else {
                            console.log('applying class: ' + src + ' to ' + target);
                            elm.classList.add(src);
                        }


                    }
                );
            }
        );
    }

    /**
     *
     * @param cssRules
     * @param selector
     * @param target
     * @param sources
     * @param keyword
     */
    function stateRule(cssRules, selector, target, sources, keyword) {
        console.log('binding message WHEN listener: ' + sources + ' to ' + selector);

        console.log('binding message listener: ' + sources);
        stateListeners.push(makeStateChangeListener(target, sources, selector, cssRules));

    }

    /**
     *
     * @param cssRules
     * @param selector
     * @param target
     * @param sources
     * @param keyword
     */
    function eventRule(cssRules, selector, target, sources, keyword) {
        var newHash = sources[0] || keyword;
        console.log('binding message events: ' + newHash + ' to ' + target + ' for ' + keyword);
        evtBindings[target] = {hash: newHash, event: keyword.substring(2)};
        var targetElms = document.querySelectorAll(target);
        [].slice.call(targetElms).forEach(
            function (elm) {
                console.log('adding eventlistener for ' + newHash);
                if (newHash === 'prevent'){
                   elm.xcssHandler = function(evt){evt.preventDefault();evt.stopPropagation();}
                } else {
                   elm.xcssHandler = makeEventListener(newHash);
                }
                elm.addEventListener(keyword.substring(2), elm.xcssHandler);
            }
        );

    }

    /**
     * logicRule is a marker function
     */
    function LogicKeyword() {

    }


    function loadContent(url, elm, level) {
        fetch(url).then(
            function (response) {
                response.text().then(function (data) {
                    console.log(url);
                    console.log(data);
                    if (url.indexOf('://')>0 && SCRIPTEXPR.test(data) || EVENTEXPR.test(data)) {
                        console.error('unsafe content ignored!');
                    } else {
                        setHtmlContent(elm, data, level);
                    }
                });
            }
        );
    }

    /**
     * handle async or sync result
     * @param elm
     * @param html
     */
    function setHtmlContent(elm, html, level) {
        if (typeof html == "string") {
            insertHTML(html, level);
        } else if (html && html.then) {
            html.then(
                function (data) {
                    insertHTML(data, level);
                }
            )
        }

        function insertHTML(html, level) {
            var tagName = elm.tagName.toLowerCase();
            if (tagName === "input" || tagName === 'textarea') {
                if (!Array.isArray(elm.orgValue)) {
                    elm.orgValue = [elm.value];
                }
                elm.value = html;
            } else {
                if (!Array.isArray(elm.orgValue)) {
                    elm.orgValue = [elm.innerHTML];
                }
                //only update if needed so we keep element events working
                //no need to bind events again if the content is not changed
                if (html !== elm.dataHtml) {
                    elm.innerHTML = html;
                    elm.dataHtml = html;
                    //if we have a change in the html rebind all events if needed
                    //so events bind seems to work as styles whenever an element
                    //matches the css rule the event is present
                    bindAllContent(elm, level || 0);
                    bindAllEvents(elm);
                    bindAllClasses(elm);
                }

            }
        }
    }

    function makeStateChangeListener(targetKey, sources, selector, cssRules) {

        console.log('makeStateChangeListener for: ' + targetKey + ', sources: ' + sources);

        var targetStates = sources.map(
            function (source) {
                var parts = source.split(/[\[\]]/);
                var path = parts.shift().trim();
                var pattern = path.replace(/\s*\*\s*/g, '.*').replace(/>/g, '\/');
                return {
                    path: path,
                    pattern: new RegExp('^' + pattern + '$'),
                    params: parts.filter(function (p) {
                        return !!p.trim();
                    }) //filter out empty parms
                };
            }
        );

        //var stateKey = msgParts[0];
        //var parms = msgParts[1];
        var cssText = '';
        var target = targetKey + '';

        return stateChangeListener;

        ////////////////////////////////////////////////////////

        function stateChangeListener(newState) {
            var matches, parms;
            var jsKey,cssKey;
            var value;
            var placeholder;
            var replacer;
            console.log('event received: ' + targetKey, 'evt:', newState);
            var path = newState.path;
            var state = newState.params;

            //replace parameter placeholders in target selector with state parameter values
            var elmQuery = target;
            Object.keys(state).forEach(
                function (key) {
                    elmQuery = elmQuery.replace('${' + key + '}', state[key]);
                }
            );


            var elms = document.querySelectorAll(elmQuery);
            for (var i = 0; i < elms.length; i++) {
                var elm = elms[i];
                console.log('event handled by ', elmQuery + '[' + i + ']');
                if (elm.cssText === undefined) {
                    elm.cssText = elm.style.cssText || '';
                }

                var content = cssRules[selector].style.content;
                var match = targetStates.filter(function (s) {
                    return s.pattern.test(path);
                });

                if (match = match[0]) {
                    parms = match.params;
                    //filter content property out before adding the cssText
                    //because an inline style does not behave well having a content property
                    cssText = cssRules[selector].style.cssText.split('; ').filter(
                        function (cssLine) {
                            return cssLine.trim().indexOf('content:') < 0;
                        }
                    ).join('\n');
                    elm.style.cssText = cssText.replace(/\$\{[^\}]*\}/g, function (v) {
                        return state[v.substring(2, v.length - 1)];
                    });


                    //then overwrite the defined style properties  with a templated  value
                    parms.forEach(
                        function (parm) {
                            var parts = parm.split('=');
                            //simple case : /path[propertyname] just replace content with value
                            if (parts.length === 1  && content) {
                                placeholder = new RegExp('\\$\\{' + parm + '\\}', 'g');
                                replacer = (state || {})[parms] || '';
                                content = content.replace(placeholder, replacer);
                                return;
                            }

                            cssKey = parts.shift();
                            //convert css dash syntax into js syntax example background-color - > backgroundColor
                            jsKey = cssKey.replace(/(-\w)/, function (v) {
                                return v.substring(1).toUpperCase();
                            });

                            //reconstruct right side of the = sign
                            value = parts.join('=').replace(/^"/, '').replace(/"$/, '');
                            if (value) {
                                //replace template variables
                                value = value.replace(/\$\{[^\}]*\}/g, function (v) {
                                    return state[v.substring(2, v.length - 1)];
                                });
                                state[jsKey] = eval(value) || '';
                                //if there is no property key like jsKey warn the programmer
                                if (elm.style[jsKey] === undefined) {
                                     console.warn('Trying to set a style key:' + cssKey + ' that does not exist!');
                                } else {
                                    elm.style[jsKey] = eval(value);;
                                }
                            }
                        }
                    );


                    if (content) {
                        if (matches = content.match(/^url\(['"]([^)]*)['"]\)$/)) {
                            loadContent(matches[1], elm);
                        } else if (matches = content.match(/^"([^"]*)"$/)) {
                            var html = eval(matches[1]);
                            setHtmlContent(elm, html);
                        }
                    }
                } else {
                    elms[i].style.cssText = elms[i].cssText;
                    if (content && Array.isArray(elm.orgValue)) {
                        var p = (['input', 'textarea'].indexOf(elm.tagName) < 0 ) ? 'innerHTML' : 'value';
                        elm[p] = elm.orgValue[0];
                        elm.dataHtml = elm.orgValue[0];

                    }
                }

            }

        }

    }


    function makeEventListener(msg) {


        return function xcssHandler(elmEvent) {
            "use strict";
            var prevPath;
            var hash = msg.split('[')[0];
            var parms = '';
            var prefix = '?';
            var key, val, attr;
            var match = msg.match(/\[([^\]]+)]$/);
            var elm = elmEvent.currentTarget || elmEvent.srcElement;


            //copy the specified (attribute) value into the hash param
            if (match && match[1] !== undefined) {
                attr = match[1].split('="');
                key = attr[0];
                val = attr[1];
                if (val) {
                    [].slice.call(elm.attributes, 0).forEach(
                        function (attr) {
                            val = val.replace('${' + attr.name + '}', attr.value);

                        }
                    );
                    val = eval(val.replace(/^"/, '').replace(/"$/, ''));
                } else {
                    val = elm[key] || elm.getAttribute(key);
                }

                parms = prefix + key + '=' + encodeURIComponent(val);

            }

            var parts = location.hash.replace(/^#/, '').split('/').map(function (p) {
                return p.split('?')[0]
            });
            var path = hash.replace(/^[#>+~\.\/]/, '').trim();
            var pathPos = parts.indexOf(path);
            var prevHash = location.hash.replace(/^#/, '').split('/');

            if (hash.indexOf('+') === 0) {
                //add state name to path
                if (pathPos >= 0) {
                    prevHash.pop();
                }
                prevHash.push(path);
                location.hash = prevHash.join('/') + parms;

            } else if (hash.indexOf('~') === 0) {
                //delete state name from path
                if (path === '*') {
                    pathPos = prevHash.length - 1;
                }
                if (pathPos >= 0) {
                    location.hash = prevHash.filter(function (x, i) {
                        return i !== pathPos;
                    }).join('/');
                }
            } else if (hash.indexOf('>') === 0) {
                //replace last state name in path
                prevPath = prevHash.pop();
                if (hash.indexOf('.') < 0) {  //this means toggle the path
                    prevHash.push(path);
                } else {
                    if (prevPath !== path) {
                        prevHash.push(prevPath);
                        prevHash.push(path);
                    }
                }
                location.hash = prevHash.join('/') + parms;
            } else if (hash.indexOf('.') === 0) {
                //allways add
                prevHash.push(path);
                location.hash = prevHash.join('/') + parms;
            } else if (hash.indexOf(':empty') === 0) {
                //do nothing with state just evaluate the js between [  ]

            } else {
                location.hash = hash + parms;
            }
            console.log('new Hash: ' + location.hash);

        };
    }

    /**
     * recursively walk through the stylesheets of same origin and collect all css rules
     * @param container
     * @param inner
     */
    function collectRules(container, inner) {
        [].slice.call(container.styleSheets || []).forEach(
            function (styleSheet) {
                if ((styleSheet.href || '').indexOf(window.location.origin) === 0) {

                    [].slice.call(styleSheet.cssRules || []).forEach(
                        function (cssRule) {
                            allCSSRules[cssRule.selectorText] = cssRule;
                        }
                    );
                }
                collectRules(styleSheet,true);
            }
        );
        if (!inner) {
            console.debug('collected nr of rules: ' + Object.keys(allCSSRules).length);
        }
    }

    function addNewStylesheet() {
        var styleEl = document.createElement('style'),
            styleSheet;

        // Append style element to head
        document.head.appendChild(styleEl);

        // Grab style sheet
        return styleEl.sheet;
    }


})();
