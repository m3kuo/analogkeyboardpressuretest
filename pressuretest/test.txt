#include <stdio.h>
// #include "wooting_analog_sdk.h" // Uncomment and set correct path if you have the SDK

int main() {
    if (!wooting_analog_initialise()) {
        fprintf(stderr, "Failed to initialize Wooting Analog SDK\n");
        return 1;
    }
    // ... rest of your code ...
    return 0;
}


