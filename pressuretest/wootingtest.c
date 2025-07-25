#include <stdio.h>
#include "wooting-analog-wrapper.h"

int main() {
    if (!wooting_analog_initialise()) {
        fprintf(stderr, "❌ Failed to initialize Wooting Analog SDK — is the keyboard connected?\n");
        return 1;
    }

    printf("✅ Wooting Analog SDK initialized — keyboard detected!\n");

    wooting_analog_uninitialise();
    return 0;
}
