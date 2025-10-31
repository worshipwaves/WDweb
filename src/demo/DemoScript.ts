// --- START OF NEW FILE src/demo/DemoScript.ts ---
export type DemoAction =
  | { type: 'reset' }
  | { type: 'narrate'; file: string; text: string }
  | { type: 'highlight'; target: string }
  | { type: 'remove_highlight'; target: string }
  | { type: 'click'; target: string }
  | { type: 'wait'; duration: number }
  | { type: 'simulate_upload' }
  | { type: 'camera_animate'; animation: 'slow_rotate' }
  | { type: 'show_cta' };

export const DemoScript: DemoAction[] = [
	// Scene 0: Reset State
  { type: 'reset' },
  { type: 'wait', duration: 500 }, // Brief pause after reset
  // Scene 1: Introduction and Audio Selection
  { type: 'narrate', file: 'narration_01.mp3', text: "Welcome to WaveDesigner. Let's turn a moment of worship into a piece of art. It all starts with a sound..." },
  { type: 'highlight', target: 'category_audio' },
  { type: 'wait', duration: 2000 },
  { type: 'click', target: 'category_audio' },
  { type: 'remove_highlight', target: 'category_audio' },
  { type: 'wait', duration: 500 },
  { type: 'highlight', target: 'subcategory_upload' },
  { type: 'wait', duration: 1000 },
  { type: 'click', target: 'subcategory_upload' },
  { type: 'remove_highlight', target: 'subcategory_upload' },
  { type: 'wait', duration: 500 }, // Allow right panel to appear
  { type: 'highlight', target: 'upload_button' },
  { type: 'wait', duration: 1500 }, // Pause on the highlighted button
  { type: 'simulate_upload' }, // This now feels like it's initiated from the button
  { type: 'remove_highlight', target: 'upload_button' },
  
  // Scene 2: The Big Reveal
  { type: 'wait', duration: 1000 }, // Wait for initial render to finish
  { type: 'narrate', file: 'narration_02.mp3', text: "And just like that, your sound becomes visible—a unique shape, captured in time." },
  { type: 'wait', duration: 4000 },

  // Scene 3: Customizing Style
  { type: 'narrate', file: 'narration_03.mp3', text: "Now, let's make it yours. A split panel adds a beautiful, modern touch." },
  { type: 'highlight', target: 'category_style' },
  { type: 'wait', duration: 1500 },
  { type: 'click', target: 'category_style' },
  { type: 'remove_highlight', target: 'category_style' },
  { type: 'wait', duration: 500 },
  { type: 'highlight', target: 'thumbnail_split' },
  { type: 'wait', duration: 1500 },
  { type: 'click', target: 'thumbnail_split' },
  { type: 'remove_highlight', target: 'thumbnail_split' },
  { type: 'wait', duration: 4000 },

  // Scene 4: Customizing Wood
  { type: 'narrate', file: 'narration_04.mp3', text: "Every piece is crafted from natural wood. Let's choose a rich, dark walnut to bring out the depth of the sound." },
  { type: 'highlight', target: 'category_wood' },
  { type: 'wait', duration: 1500 },
  { type: 'click', target: 'category_wood' },
  { type: 'remove_highlight', target: 'category_wood' },
  { type: 'wait', duration: 500 },
  { type: 'highlight', target: 'wood_walnut' },
  { type: 'wait', duration: 1500 },
  { type: 'click', target: 'wood_walnut' },
  { type: 'remove_highlight', target: 'wood_walnut' },
  { type: 'wait', duration: 4000 },

  // Scene 5: Final Cinematic
  { type: 'camera_animate', animation: 'slow_rotate' },
  { type: 'narrate', file: 'narration_05.mp3', text: "Simple, intuitive, and deeply personal. Your moment, your art... forever on display." },
  { type: 'wait', duration: 6000 },
  { type: 'narrate', file: 'narration_06.mp3', text: "Now, it's your turn to create." },
  { type: 'show_cta' },
];
// --- END OF NEW FILE ---