#include <CoreGraphics/CoreGraphics.h>
#include <AppKit/AppKit.h>
#include <ScriptingBridge/ScriptingBridge.h>
#include <stdlib.h>
#include <string.h>

// Helper function to get visible windows as an NSString
NSString* getVisibleWindowsNSString() {
    CFArrayRef windowList = CGWindowListCopyWindowInfo(
        kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements,
        kCGNullWindowID
    );
    if (!windowList) return @"";

    NSMutableArray<NSString*> *windowEntries = [NSMutableArray array];
    NSMutableSet<NSNumber*> *seenWindowIds = [NSMutableSet set]; // Track unique window IDs
    CFIndex count = CFArrayGetCount(windowList);
    for (CFIndex i = 0; i < count; i++) {
        CFDictionaryRef windowInfo = (CFDictionaryRef)CFArrayGetValueAtIndex(windowList, i);
        CFNumberRef windowIdRef = (CFNumberRef)CFDictionaryGetValue(windowInfo, kCGWindowNumber);
        int windowId;
        CFNumberGetValue(windowIdRef, kCFNumberIntType, &windowId);
        NSNumber *windowIdNum = @(windowId);
        if ([seenWindowIds containsObject:windowIdNum]) continue; // Skip duplicates
        [seenWindowIds addObject:windowIdNum];

        CFNumberRef pidRef = (CFNumberRef)CFDictionaryGetValue(windowInfo, kCGWindowOwnerPID);
        if (!pidRef) continue;
        int pid;
        CFNumberGetValue(pidRef, kCFNumberIntType, &pid);
        NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
        if (!app || !app.bundleIdentifier) continue;

        // Determine app name with fallback logic
        NSString *name = app.localizedName;
        if (app.bundleURL) {
            NSString *infoPlistPath = [app.bundleURL.path stringByAppendingPathComponent:@"Contents/Resources/en.lproj/InfoPlist.strings"];
            NSDictionary *englishInfo = [NSDictionary dictionaryWithContentsOfFile:infoPlistPath];
            if (englishInfo) {
                NSString *displayName = englishInfo[@"CFBundleDisplayName"] ?: englishInfo[@"CFBundleName"];
                if (displayName) name = displayName;
            }
        }
        if (!name) name = app.bundleIdentifier;

        // Get launch time (kept in output format for backward compatibility)
        NSTimeInterval launchTime = [app.launchDate timeIntervalSince1970];

        // Get window dimensions
        CFDictionaryRef boundsDict = (CFDictionaryRef)CFDictionaryGetValue(windowInfo, kCGWindowBounds);
        int width = 0, height = 0;
        if (boundsDict) {
            CGRect bounds;
            CGRectMakeWithDictionaryRepresentation(boundsDict, &bounds);
            width = (int)bounds.size.width;
            height = (int)bounds.size.height;
        }

        // Get window title
        NSString *title = (NSString *)CFDictionaryGetValue(windowInfo, kCGWindowName) ?: @"";

        // Check if window is frontmost
        CFNumberRef layerRef = (CFNumberRef)CFDictionaryGetValue(windowInfo, kCGWindowLayer);
        int layer;
        CFNumberGetValue(layerRef, kCFNumberIntType, &layer);
        int isFrontmost = (layer == 0) ? 1 : 0;

        // Format: appName|bundleId|launchTime|windowId|width|height|title|isFrontmost
        NSString *entry = [NSString stringWithFormat:@"%@|%@|%.0f|%d|%d|%d|%@|%d",
                           name, app.bundleIdentifier, launchTime, windowId, width, height, title, isFrontmost];
        [windowEntries addObject:entry];
    }
    CFRelease(windowList);
    return [windowEntries componentsJoinedByString:@"\n"];
}

// Exported function to get visible windows
char* get_visible_windows() {
    NSString *nsString = getVisibleWindowsNSString();
    const char *utf8String = [nsString UTF8String];
    if (!utf8String) {
        char *empty = (char*)malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }

    size_t length = strlen(utf8String) + 1;
    char *result = (char*)malloc(length);
    if (!result) return NULL;
    strcpy(result, utf8String);
    return result;
}

// Exported function to get the current Safari tab URL and title
const char* get_safari_current_tab() {
    @try {
        // Get Safari application instance
        SBApplication *safari = [SBApplication applicationWithBundleIdentifier:@"com.apple.Safari"];
        if (!safari || ![safari isRunning]) {
            char *empty = (char*)malloc(1);
            if (empty) empty[0] = '\0';
            return empty;
        }

        id safariApp = safari;
        NSArray *windows = [safariApp windows];
        if (!windows || [windows count] == 0) {
            char *empty = (char*)malloc(1);
            if (empty) empty[0] = '\0';
            return empty;
        }

        id frontWindow = windows[0];
        if (!frontWindow || ![frontWindow respondsToSelector:@selector(currentTab)]) {
            char *empty = (char*)malloc(1);
            if (empty) empty[0] = '\0';
            return empty;
        }

        id currentTab = [frontWindow currentTab];
        if (!currentTab || ![currentTab respondsToSelector:@selector(URL)] || ![currentTab respondsToSelector:@selector(name)]) {
            char *empty = (char*)malloc(1);
            if (empty) empty[0] = '\0';
            return empty;
        }

        id urlObject = [currentTab URL];
        id titleObject = [currentTab name];
        NSString *urlString = @"";
        NSString *titleString = @"";

        if ([urlObject isKindOfClass:[NSURL class]]) {
            urlString = [(NSURL *)urlObject absoluteString];
        } else if ([urlObject isKindOfClass:[NSString class]]) {
            urlString = (NSString *)urlObject;
        }

        if ([titleObject isKindOfClass:[NSString class]]) {
            titleString = (NSString *)titleObject;
        }

        NSString *resultString = [NSString stringWithFormat:@"%@|%@", urlString, titleString];
        const char *utf8String = [resultString UTF8String];
        size_t length = strlen(utf8String) + 1;
        char *result = (char*)malloc(length);
        if (!result) return NULL;
        strcpy(result, utf8String);
        return result;
    } @catch (NSException *exception) {
        char *empty = (char*)malloc(1);
        if (empty) empty[0] = '\0';
        return empty;
    }
}

// Exported function to free memory for windows
void free_visible_windows(char* ptr) {
    if (ptr) free(ptr);
}