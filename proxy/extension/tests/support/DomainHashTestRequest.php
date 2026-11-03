<?php

namespace Tent\Cache\Tests;

use Tent\Models\RequestInterface;

/**
 * Minimal RequestInterface double carrying a fixed domain and query string.
 *
 * Deliberately independent of Tent's own Request/ProcessingRequest classes,
 * so DomainHash's use of `RequestInterface::domain()` can be exercised with
 * a fixed domain and query string, without building a full Tent request.
 * (Since Tent 1.1.0, the `darthjee/tent-test` image's bundled Tent source
 * also ships `domain()`; older test images lacked it.)
 */
class DomainHashTestRequest implements RequestInterface
{
    public function __construct(private string $domain, private string $query)
    {
    }

    public function requestMethod()
    {
        return 'GET';
    }

    public function body()
    {
        return '';
    }

    public function headers()
    {
        return [];
    }

    public function requestPath(): string
    {
        return '/issues.json';
    }

    public function query()
    {
        return $this->query;
    }

    public function uploadedFiles(): array
    {
        return [];
    }

    public function postFields(): array
    {
        return [];
    }

    public function domain(): string
    {
        return $this->domain;
    }
}
