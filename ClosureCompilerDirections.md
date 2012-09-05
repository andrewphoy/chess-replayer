## Directions for Google Closure compiler ##

 1. Change var DEBUG = true to false.
 2. Compile using the appspot website.
 3. Wrap the output in a closure (function(){%output%})()

These steps can also be automated using a local version of the java compiler
in which case steps (1) and (3) are simply command line flags