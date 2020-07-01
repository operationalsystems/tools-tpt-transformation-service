﻿/**
 * Add custom footnotes to an InDesign document.
 * @param {Document} doc InDesign Document object.
 * @param {string} footnoteMarkers CSV string of footnotes. EG: "'а, б, в, г, д, е, ж, з, и, й, к, л, м, н, о, п, р, с, т, у, ф, х, ц, ч, ш, щ, ы, э, ю, я'" 
 */
function addCustomFootnotes(doc, footnoteMarkers) {

	// validate the state, version, and input.
	if (!app.documents.length) exit();
	if (parseInt(app.version) < 14) {
		alert('This function works in CC2019 and later');
		exit();
	}

	if (!doc) {
		throw "doc is null";
	}
	if (!footnoteMarkers) {
		throw "footnoteMarkers is null";
	}

	// These are the symbols used as the new custom footnote markers.
	// Normalizing footnotes. EG: "'а, б, в, г, д, е, ж, з, и, й, к, л, м, н, о, п, р, с, т, у, ф, х, ц, ч, ш, щ, ы, э, ю, я'" -> "а,б,в,г,д,е,ж,з,и,й,к,л,м,н,о,п,р,с,т,у,ф,х,ц,ч,ш,щ,ы,э,ю,я"
	var symbols = footnoteMarkers
		.replace(/[ ]/g, "");

	if (symbols.length > 0) {
		symbols = symbols.split(',');
		var symbolsLe = symbols.length;
	} else {
		throw "footnoteMarkers has no markers.";
	}

	var sep = doc.footnoteOptions.separatorText;

	// Style for the custom footnotes. We'll base it 
	// from the style set in the footnote options.
	// The script simply clones the style, the user
	// will have to add any format changes.
	var footnoteStyleName;

	// The style set in the footnote options, 
	// applied to the footnote references
	var footnoteReferenceStyleName = 'Custom footnote reference';

	// The style used for the fake numbers in the notes
	var footnoteNumberStyleName = 'Custom footnote number';

	// The style that hides the real footnote references and numbers
	var hideStyleName = 'Hide original footnote';

	function addMissingStyles() {

		var fnoteStyle = doc.footnoteOptions.footnoteTextStyle;
		var fnoteStyleName = fnoteStyle.name.replace(/[\[\]]/g, '') + ' custom';
		if (!doc.paragraphStyles.item(fnoteStyleName).isValid) {
			doc.paragraphStyles.add({
				name: fnoteStyleName,
				basedOn: fnoteStyle
			});
		}

		if (!doc.characterStyles.item(footnoteReferenceStyleName).isValid) {
			doc.characterStyles.add({
				name: footnoteReferenceStyleName,
				position: Position.SUPERSCRIPT
			});
		}

		footnoteReferenceStyleName = doc.characterStyles.item(footnoteReferenceStyleName);
		try {
			footnoteReferenceStyleName.fontStyle = 'Italic';
		} catch (_) {
		}

		if (!doc.characterStyles.item(footnoteNumberStyleName).isValid) {
			doc.characterStyles.add({
				name: footnoteNumberStyleName,
				basedOn: footnoteReferenceStyleName
			})
		}

		if (!doc.characterStyles.item(hideStyleName).isValid) {
			doc.characterStyles.add({
				name: hideStyleName,
				pointSize: 0.1,
				horizontaScale: 1
			});
		}

		footnoteStyleName = doc.paragraphStyles.item(fnoteStyleName);
		footnoteNumberStyleName = doc.characterStyles.item(footnoteNumberStyleName);
		hideStyleName = doc.characterStyles.item(hideStyleName);
	}

	function numberToSymbol(n) {
		return symbols[n % symbolsLe];
	}

	function getCue(n) {
		return numberToSymbol(n);
	}

	//-------------------------------------------------------------
	// First undo any lettering, maybe we're updating a frame 
	// in which a notes were added or removed after the conversion.

	function undoLetters(table) {
		// Remove the contents of the cue style. InDesign then
		// removes the character-style instance
		app.findGrepPreferences = app.changeGrepPreferences = null;
		app.findGrepPreferences.appliedCharacterStyle = footnoteReferenceStyleName;
		table.changeGrep();

		// Then delete the note numbers.
		app.findGrepPreferences.appliedCharacterStyle = null;
		app.findGrepPreferences.findWhat = '^[a-z].*(?=~F)';

		table.changeGrep();
	}

	//----------------------------------------------------------
	// Add the letters at the cues and the numbers.

	function applyLetters(table) {

		var i, ix;
		var txt;
		var fn = table.footnotes.everyItem().getElements();

		// 1. The content itself. Insert the letters and add their style,
		// and apply the hiding style to the cues.

		for (i = fn.length - 1; i >= 0; i--) {
			ix = fn[i].storyOffset.index;
			txt = fn[i].storyOffset.parent.texts[0];
			txt.insertionPoints[ix + 1].appliedCharacterStyle = footnoteReferenceStyleName;
			txt.insertionPoints[ix + 1].contents = getCue(i);
			txt.characters[ix].appliedCharacterStyle = hideStyleName;
		}

		// 2. The notes. Insert the letter.
		app.findGrepPreferences = null;
		app.findGrepPreferences.findWhat = '~F' + sep;
		app.findChangeGrepOptions.includeFootnotes = true;
		fn = table.findGrep();
		for (i = fn.length - 1; i >= 0; i--) {
			fn[i].texts[0].applyParagraphStyle(footnoteStyleName, false);
			fn[i].insertionPoints[0].contents = getCue(i);// + '\u2002';
			fn[i].paragraphs[0].characters[0].appliedCharacterStyle = footnoteNumberStyleName;
			fn[i].appliedCharacterStyle = hideStyleName;
		}
	}

	//--------------------------------------------------------------
	app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;

	// Create styles if necessary.
	addMissingStyles();

	// Grab each story, and apply custom footnote markers to the pre-existing footnoes.

	var storyElements = doc.stories.everyItem().getElements();

	for (var i = storyElements.length - 1; i >= 0; i--) {
		applyLetters(storyElements[i]);
	}
}